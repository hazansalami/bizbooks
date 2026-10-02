"use server";

import { grantTrialBonus } from "@/lib/growth";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, type CurrentBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { computePay, payDateFor, periodLabel } from "@/lib/payroll";
import { parseAmount, round2 } from "@/lib/money";
import { NUBAN } from "@/lib/business";
import { FREE_PAYROLL_LIMIT } from "@/lib/constants";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { dateOrNull, randomToken, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

export async function saveEmployee(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const id = str(form, "id");
  const errors: Record<string, string> = {};
  const kind = str(form, "kind") === "CONTRACTOR" ? "CONTRACTOR" : "EMPLOYEE";
  const fullName = str(form, "fullName");
  if (fullName.length < 2) errors.fullName = "Enter their full name.";
  const monthlyGross = parseAmount(str(form, "monthlyGross"));
  if (!(monthlyGross > 0)) errors.monthlyGross = kind === "CONTRACTOR" ? "Enter the monthly fee." : "Enter their monthly gross pay.";
  const email = str(form, "email").toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "That email doesn't look right.";
  const accountNumber = str(form, "accountNumber").replace(/\s/g, "");
  if (accountNumber && !NUBAN.test(accountNumber)) errors.accountNumber = "Nigerian account numbers have 10 digits.";
  const annualRent = parseAmount(str(form, "annualRent")) || 0;
  if (annualRent < 0) errors.annualRent = "Rent can't be negative.";
  if (Object.keys(errors).length) return { errors, values };

  if (!id && !isPro(business)) {
    const active = await db.employee.count({ where: { businessId: business.id, status: "ACTIVE" } });
    if (active >= FREE_PAYROLL_LIMIT) {
      return { message: `The Free plan runs payroll for up to ${FREE_PAYROLL_LIMIT} people. Upgrade to Pro to add your whole team.`, values };
    }
  }

  const data = {
    kind, fullName, email: email || null, phone: str(form, "phone") || null, jobTitle: str(form, "jobTitle") || null,
    monthlyGross: round2(monthlyGross), annualRent: round2(annualRent),
    pension: kind === "EMPLOYEE" && str(form, "pension") === "on", pfa: str(form, "pfa") || null, pensionPin: str(form, "pensionPin") || null,
    nhf: kind === "EMPLOYEE" && str(form, "nhf") === "on",
    whtRate: [0, 2, 5, 10].includes(Number(str(form, "whtRate"))) ? Number(str(form, "whtRate")) : 5,
    bankName: str(form, "bankName") || null, accountNumber: accountNumber || null, accountName: str(form, "accountName") || null,
    startDate: dateOrNull(form, "startDate"),
  };
  if (id) {
    const e = await db.employee.findFirst({ where: { id, businessId: business.id } });
    if (!e) return { message: "Team member not found." };
    await db.employee.update({ where: { id }, data });
  } else {
    await db.employee.create({ data: { ...data, businessId: business.id } });
  }
  revalidatePath("/app/payroll");
  redirect("/app/payroll/team");
}

export async function setEmployeeStatus(form: FormData) {
  const { business } = await requireBusiness();
  const status = str(form, "status") === "LEFT" ? "LEFT" : "ACTIVE";
  // Bringing someone back counts towards the Free plan's limit, same as adding them.
  if (status === "ACTIVE" && !isPro(business) && (await db.employee.count({ where: { businessId: business.id, status: "ACTIVE" } })) >= FREE_PAYROLL_LIMIT) {
    redirect(`/app/payroll/team?error=limit`);
  }
  await db.employee.updateMany({ where: { id: str(form, "id"), businessId: business.id }, data: { status } });
  revalidatePath("/app/payroll/team");
}

/** On Free, a pay run covers the first people added, up to the Free limit (the rest wait for Pro). */
async function fillRun(runId: string, business: CurrentBusiness) {
  const businessId = business.id;
  const everyone = await db.employee.findMany({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  const employees = (isPro(business) ? everyone : everyone.slice(0, FREE_PAYROLL_LIMIT)).sort((a, b) => a.fullName.localeCompare(b.fullName));
  // Keep each person's payslip link when a draft run is refreshed: links may already be shared with staff.
  const tokens = new Map((await db.payItem.findMany({ where: { payRunId: runId }, select: { employeeId: true, publicToken: true } })).map((i) => [i.employeeId, i.publicToken]));
  const items = employees.map((e) => {
    const p = computePay(e);
    return {
      payRunId: runId, employeeId: e.id, fullName: e.fullName, jobTitle: e.jobTitle, kind: e.kind,
      bankName: e.bankName, accountNumber: e.accountNumber, accountName: e.accountName ?? e.fullName,
      ...p, publicToken: tokens.get(e.id) ?? randomToken(),
    };
  });
  const sum = (k: keyof (typeof items)[number]) => round2(items.reduce((s, i) => s + (i[k] as number), 0));
  await db.$transaction([
    db.payItem.deleteMany({ where: { payRunId: runId } }),
    db.payItem.createMany({ data: items }),
    db.payRun.update({
      where: { id: runId },
      data: {
        gross: sum("gross"), paye: sum("paye"), pensionEmployee: sum("pensionEmployee"), pensionEmployer: sum("pensionEmployer"),
        nhf: sum("nhf"), wht: sum("wht"), net: sum("net"),
      },
    }),
  ]);
}

export async function createPayRun(form: FormData) {
  const { business } = await requireBusiness();
  const period = str(form, "period");
  if (!/^\d{4}-\d{2}$/.test(period)) redirect("/app/payroll");
  if ((await db.employee.count({ where: { businessId: business.id, status: "ACTIVE" } })) === 0) redirect("/app/payroll/team/new");
  const existing = await db.payRun.findUnique({ where: { businessId_period: { businessId: business.id, period } } });
  if (existing) redirect(`/app/payroll/runs/${existing.id}`);
  const run = await db.payRun.create({ data: { businessId: business.id, period, payDate: payDateFor(period, business.payDay) } });
  await fillRun(run.id, business);
  redirect(`/app/payroll/runs/${run.id}`);
}

async function ownRun(id: string) {
  const { business } = await requireBusiness();
  const run = await db.payRun.findFirst({ where: { id, businessId: business.id }, include: { items: true } });
  if (!run) redirect("/app/payroll");
  return { business, run };
}

export async function refreshPayRun(form: FormData) {
  const { business, run } = await ownRun(str(form, "id"));
  if (run.status !== "DRAFT") return;
  const payDate = dateOrNull(form, "payDate");
  if (payDate) await db.payRun.update({ where: { id: run.id }, data: { payDate } });
  await fillRun(run.id, business);
  revalidatePath(`/app/payroll/runs/${run.id}`);
}

/**
 * The owner has paid salaries from their own bank. Record the cost in the books so profit and
 * cash flow include payroll without anyone entering it twice.
 */
export async function markPayRunPaid(form: FormData) {
  const { business, run } = await ownRun(str(form, "id"));
  if (run.status !== "DRAFT" || run.items.length === 0) return;
  const label = periodLabel(run.period);
  const staffGross = round2(run.items.filter((i) => i.kind !== "CONTRACTOR").reduce((s, i) => s + i.gross, 0));
  const contractorGross = round2(run.items.filter((i) => i.kind === "CONTRACTOR").reduce((s, i) => s + i.gross, 0));
  const lines = [
    { category: "Salaries & wages", amount: staffGross, note: `${label} payroll (gross, including PAYE and staff pension)` },
    { category: "Pension (employer)", amount: run.pensionEmployer, note: `${label} employer pension contribution` },
    { category: "Contractors & freelancers", amount: contractorGross, note: `${label} contractor fees (gross, including WHT)` },
  ].filter((l) => l.amount > 0);
  const marked = await db.$transaction(async (tx) => {
    // Claim the run first, so a double tap can't book the payroll expenses twice.
    const claimed = await tx.payRun.updateMany({ where: { id: run.id, status: "DRAFT" }, data: { status: "PAID", paidAt: new Date() } });
    if (claimed.count !== 1) return false;
    await tx.expense.createMany({
      data: lines.map((l) => ({ businessId: business.id, date: run.payDate, amount: l.amount, category: l.category, vendor: "Payroll", note: l.note, payRunId: run.id })),
    });
    return true;
  });
  if (!marked) return;
  await grantTrialBonus(business.id, "PAYROLL_OR_IMPORT");
  revalidatePath("/app/payroll");
  revalidatePath(`/app/payroll/runs/${run.id}`);
}

export async function reopenPayRun(form: FormData) {
  const { run } = await ownRun(str(form, "id"));
  if (run.status !== "PAID") return;
  await db.$transaction([
    db.expense.deleteMany({ where: { payRunId: run.id } }),
    db.payRun.update({ where: { id: run.id }, data: { status: "DRAFT", paidAt: null } }),
  ]);
  revalidatePath(`/app/payroll/runs/${run.id}`);
}

export async function deletePayRun(form: FormData) {
  const { run } = await ownRun(str(form, "id"));
  if (run.status === "DRAFT") await db.payRun.delete({ where: { id: run.id } });
  revalidatePath("/app/payroll");
  redirect("/app/payroll");
}

export async function emailPayslips(_: FormState, form: FormData): Promise<FormState> {
  const { business, run } = await ownRun(str(form, "id"));
  if (!isPro(business)) return { message: "Emailed payslips are part of Pro. You can still open and share each payslip link." };
  const employees = await db.employee.findMany({ where: { id: { in: run.items.map((i) => i.employeeId) } }, select: { id: true, email: true } });
  const emailOf = new Map(employees.map((e) => [e.id, e.email]));
  let sent = 0;
  for (const item of run.items) {
    const to = emailOf.get(item.employeeId);
    if (!to) continue;
    const { html, text } = layout({
      heading: `Your ${periodLabel(run.period)} payslip`,
      paragraphs: [`Hello ${esc(item.fullName.split(" ")[0])}, your payslip from ${esc(business.name)} is ready.`],
      button: { label: "View payslip", href: new URL(`/payslip/${item.publicToken}`, siteUrl()).toString() },
      color: business.brandColor,
      footer: business.name,
    });
    const r = await sendEmail({ to, subject: `${business.name}: ${periodLabel(run.period)} payslip`, html, text, replyTo: business.email, fromName: business.name });
    if (r.ok) sent++;
  }
  const missing = run.items.length - sent;
  return { ok: sent > 0, message: sent ? `Sent ${sent} payslip${sent > 1 ? "s" : ""}.${missing ? ` ${missing} ${missing > 1 ? "people have" : "person has"} no email saved.` : ""}` : "Nobody on this run has an email address saved." };
}
