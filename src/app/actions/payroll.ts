"use server";

import { grantTrialBonus } from "@/lib/growth";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
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
  const { user, business } = await requireBusiness();
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
    pension: kind === "EMPLOYEE" && str(form, "pension") === "on",
    paye: kind === "EMPLOYEE" && str(form, "paye") === "on", pfa: str(form, "pfa") || null, pensionPin: str(form, "pensionPin") || null,
    nhf: kind === "EMPLOYEE" && str(form, "nhf") === "on",
    whtRate: [0, 2, 5, 10].includes(Number(str(form, "whtRate"))) ? Number(str(form, "whtRate")) : 5,
    bankName: str(form, "bankName") || null, accountNumber: accountNumber || null, accountName: str(form, "accountName") || null,
    startDate: dateOrNull(form, "startDate"),
  };
  // Where salaries are paid is the owner's call: an accountant's edits leave bank details as they were.
  const bankFields = ["bankName", "accountNumber", "accountName"] as const;
  if (user.role !== "OWNER") for (const k of bankFields) delete (data as Partial<typeof data>)[k];
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

/**
 * Who handles PAYE for staff: the company (deduct and remit) or each employee. Sets the default for new staff,
 * and with "apply to everyone" updates current staff too. Each person can still be changed on their own page.
 */
export async function setPayeDefault(form: FormData) {
  const { business } = await requireBusiness();
  const companyDeducts = str(form, "paye") === "company";
  await db.business.update({ where: { id: business.id }, data: { payeDefault: companyDeducts } });
  if (str(form, "applyAll") === "on") {
    await db.employee.updateMany({ where: { businessId: business.id, kind: "EMPLOYEE", status: "ACTIVE" }, data: { paye: companyDeducts } });
  }
  revalidatePath("/app/payroll/team");
  revalidatePath("/app/payroll");
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
    // payeStatus is for display; the pay item stores the amounts (and payeByEmployee) instead.
    const { payeStatus: _status, ...p } = computePay(e);
    return {
      payRunId: runId, employeeId: e.id, fullName: e.fullName, jobTitle: e.jobTitle, kind: e.kind,
      bankName: e.bankName, accountNumber: e.accountNumber, accountName: e.accountName ?? e.fullName,
      ...p, publicToken: tokens.get(e.id) ?? randomToken(), payeByEmployee: _status === "SELF",
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

/** Run status from its people: everyone paid, some paid, or nobody yet. */
async function settleRunStatus(tx: Prisma.TransactionClient, runId: string) {
  const [total, paid, last] = await Promise.all([
    tx.payItem.count({ where: { payRunId: runId } }),
    tx.payItem.count({ where: { payRunId: runId, paidAt: { not: null } } }),
    tx.payItem.findFirst({ where: { payRunId: runId, paidAt: { not: null } }, orderBy: { paidAt: "desc" }, select: { paidAt: true } }),
  ]);
  const status = paid === 0 ? "DRAFT" : paid < total ? "PARTIAL" : "PAID";
  await tx.payRun.update({ where: { id: runId }, data: { status, paidAt: status === "PAID" ? last?.paidAt ?? new Date() : null } });
}

/**
 * The owner has paid some or all of the team from their own bank. Each person paid gets their own salary
 * (or contractor fee) and employer pension expense, so profit and cash flow include payroll without anyone
 * entering it twice, and one person can be un-paid without touching the others.
 * Form: "item" (one per person ticked), or op=all for everyone not yet paid; "paidAt" (defaults to the pay date).
 */
export async function markPayRunPaid(form: FormData) {
  const { business, run } = await ownRun(str(form, "id"));
  const all = str(form, "op") === "all";
  const picked = new Set(form.getAll("item").map(String));
  const targets = run.items.filter((i) => !i.paidAt && (all || picked.has(i.id)));
  if (!targets.length) return;
  const paidAt = dateOrNull(form, "paidAt") ?? run.payDate;
  const label = periodLabel(run.period);
  await db.$transaction(async (tx) => {
    for (const i of targets) {
      // Claim each person first, so a double tap can't book their pay twice.
      const claimed = await tx.payItem.updateMany({ where: { id: i.id, paidAt: null }, data: { paidAt } });
      if (claimed.count !== 1) continue;
      const contractor = i.kind === "CONTRACTOR";
      const lines = [
        { category: contractor ? "Contractors & freelancers" : "Salaries & wages", amount: i.gross, note: `${label} ${contractor ? "fee (gross, including WHT)" : "salary (gross, including PAYE and staff pension)"}: ${i.fullName}` },
        { category: "Pension (employer)", amount: i.pensionEmployer, note: `${label} employer pension: ${i.fullName}` },
      ].filter((l) => l.amount > 0);
      await tx.expense.createMany({
        data: lines.map((l) => ({ businessId: business.id, date: paidAt, amount: l.amount, category: l.category, vendor: "Payroll", note: l.note, payRunId: run.id, payItemId: i.id })),
      });
    }
    await settleRunStatus(tx, run.id);
  });
  await grantTrialBonus(business.id, "PAYROLL_OR_IMPORT");
  revalidatePath("/app/payroll");
  revalidatePath(`/app/payroll/runs/${run.id}`);
}

/**
 * Undo one person's payment: their payroll expenses come off and they're unpaid again.
 * The item id is bound into the action (a formAction button can't carry its own name/value).
 */
export async function unmarkPayItem(itemId: string, form: FormData) {
  const { run } = await ownRun(str(form, "id"));
  const item = run.items.find((i) => i.id === itemId);
  if (!item?.paidAt) return;
  await db.$transaction(async (tx) => {
    await tx.expense.deleteMany({ where: { payRunId: run.id, payItemId: item.id } });
    await tx.payItem.update({ where: { id: item.id }, data: { paidAt: null } });
    await settleRunStatus(tx, run.id);
  });
  revalidatePath("/app/payroll");
  revalidatePath(`/app/payroll/runs/${run.id}`);
}

/** Undo the whole run: every payroll expense it added comes off and nobody is marked paid. */
export async function reopenPayRun(form: FormData) {
  const { run } = await ownRun(str(form, "id"));
  if (run.status === "DRAFT") return;
  await db.$transaction([
    db.expense.deleteMany({ where: { payRunId: run.id } }),
    db.payItem.updateMany({ where: { payRunId: run.id }, data: { paidAt: null } }),
    db.payRun.update({ where: { id: run.id }, data: { status: "DRAFT", paidAt: null } }),
  ]);
  revalidatePath("/app/payroll");
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
