"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { EXPENSE_CATEGORIES, FREE_RECURRING_EXPENSE_LIMIT, FREQUENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { parseAmount, round2 } from "@/lib/money";
import { advance } from "@/lib/recurring";
import { isPro } from "@/lib/plan";
import { dateOrNull, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

type Biz = Awaited<ReturnType<typeof requireBusiness>>["business"];

function readExpense(form: FormData) {
  const values = Object.fromEntries(["amount", "category", "date", "vendor", "note", "vatAmount", "method", "frequency", "title", "status", "dueDate"].map((k) => [k, str(form, k)]));
  const errors: Record<string, string> = {};
  const amount = parseAmount(values.amount);
  if (!(amount > 0)) errors.amount = "Enter how much you spent.";
  if (!EXPENSE_CATEGORIES.includes(values.category)) errors.category = "Pick what it was for.";
  const date = dateOrNull(form, "date");
  if (!date) errors.date = "Choose the date.";
  const vat = parseAmount(values.vatAmount) || 0;
  if (vat < 0 || vat > amount) errors.vatAmount = "VAT can't be more than the amount.";
  const isBill = str(form, "status") === "bill";
  const dueDate = dateOrNull(form, "dueDate");
  if (isBill && !dueDate) errors.dueDate = "When do you need to pay it by?";
  const receipt = str(form, "receipt");
  if (receipt && (!receipt.startsWith("data:image/") || receipt.length > 450_000)) errors.receipt = "That photo is too large. Try again. We shrink it automatically.";
  return {
    values, errors, receipt,
    bill: { paid: !isBill, dueDate: isBill ? dueDate : null, paidAt: null as Date | null },
    data: {
      amount: round2(amount), category: values.category, date: date!, vendor: values.vendor || null, note: values.note || null,
      vatAmount: round2(vat), method: values.method in PAYMENT_METHODS ? values.method : "BANK_TRANSFER",
    },
  };
}

async function recurringAllowed(business: Biz) {
  if (isPro(business)) return true;
  const active = await db.recurringExpense.count({ where: { businessId: business.id, status: { in: ["ACTIVE", "PAUSED"] } } });
  return active < FREE_RECURRING_EXPENSE_LIMIT;
}

export async function saveExpense(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const { values, errors, data, receipt, bill } = readExpense(form);
  const repeat = str(form, "repeat") === "on" && !str(form, "id");
  if (repeat && !(values.frequency in FREQUENCIES)) errors.frequency = "Choose how often it repeats.";
  if (Object.keys(errors).length) return { errors, values };
  if (repeat && !(await recurringAllowed(business))) {
    return { message: `The Free plan includes ${FREE_RECURRING_EXPENSE_LIMIT} recurring expenses. Upgrade to Pro for unlimited, or untick “Repeat”.`, values };
  }

  const id = str(form, "id");
  if (id) {
    const e = await db.expense.findFirst({ where: { id, businessId: business.id } });
    if (!e) return { message: "Expense not found." };
    // A paid expense stays paid (the form doesn't offer turning it back into a bill, and neither does the server).
    // A bill marked paid while editing counts as paid today, so cash flow puts it on the day the money left.
    const billFields = e.paid ? {} : bill.paid ? { paid: true, paidAt: new Date() } : bill;
    await db.expense.update({ where: { id }, data: { ...data, ...billFields, receipt: receipt || e.receipt } });
  } else {
    // "Repeat" sets up the schedule and records this one as its first entry.
    const recurring = repeat
      ? await db.recurringExpense.create({
          data: {
            businessId: business.id, title: values.title || values.vendor || values.category, category: data.category, vendor: data.vendor,
            amount: data.amount, vatAmount: data.vatAmount, method: data.method, frequency: values.frequency, nextRunAt: advance(data.date, values.frequency), asBill: !bill.paid,
          },
        })
      : null;
    await db.expense.create({ data: { ...data, ...bill, receipt: receipt || null, businessId: business.id, recurringExpenseId: recurring?.id ?? null } });
  }
  revalidatePath("/app/expenses");
  if (str(form, "intent") === "another") return { ok: true, message: "Saved. Add the next one.", values: { nonce: String(Date.now()) } };
  redirect(repeat ? "/app/expenses/recurring" : !bill.paid ? "/app/expenses?filter=bills" : "/app/expenses");
}

export async function markBillPaid(form: FormData) {
  const { business } = await requireBusiness();
  const paidAt = dateOrNull(form, "paidAt") ?? new Date();
  await db.expense.updateMany({ where: { id: str(form, "id"), businessId: business.id, paid: false }, data: { paid: true, paidAt } });
  revalidatePath("/app/expenses");
  revalidatePath("/app");
}

export async function deleteExpense(form: FormData) {
  const { business } = await requireBusiness();
  // Payroll entries are removed by reopening the pay run, so the two never disagree.
  await db.expense.deleteMany({ where: { id: str(form, "id"), businessId: business.id, payRunId: null } });
  revalidatePath("/app/expenses");
}

export async function saveRecurringExpense(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const values = Object.fromEntries(["title", "amount", "category", "vendor", "vatAmount", "method", "frequency", "nextRunAt", "endAt", "asBill", "dueInDays"].map((k) => [k, str(form, k)]));
  const errors: Record<string, string> = {};
  const amount = parseAmount(values.amount);
  if (values.title.length < 2) errors.title = "Give it a name, e.g. “Office rent”.";
  if (!(amount > 0)) errors.amount = "Enter the amount.";
  if (!EXPENSE_CATEGORIES.includes(values.category)) errors.category = "Pick a category.";
  if (!(values.frequency in FREQUENCIES)) errors.frequency = "Choose how often.";
  const nextRunAt = dateOrNull(form, "nextRunAt");
  if (!nextRunAt) errors.nextRunAt = "Choose when it's next due.";
  const vat = parseAmount(values.vatAmount) || 0;
  if (vat < 0 || vat > amount) errors.vatAmount = "VAT can't be more than the amount.";
  if (Object.keys(errors).length) return { errors, values };
  const id = str(form, "id");
  if (!id && !(await recurringAllowed(business))) {
    return { message: `The Free plan includes ${FREE_RECURRING_EXPENSE_LIMIT} recurring expenses. Upgrade to Pro for unlimited.`, values };
  }
  const data = {
    title: values.title, amount: round2(amount), category: values.category, vendor: values.vendor || null, vatAmount: round2(vat),
    method: values.method in PAYMENT_METHODS ? values.method : "BANK_TRANSFER", frequency: values.frequency, nextRunAt: nextRunAt!,
    endAt: dateOrNull(form, "endAt"),
    asBill: values.asBill === "on",
    dueInDays: [0, 7, 14, 30].includes(Number(values.dueInDays)) ? Number(values.dueInDays) : 0,
  };
  if (id) {
    const r = await db.recurringExpense.findFirst({ where: { id, businessId: business.id } });
    if (!r) return { message: "Not found." };
    await db.recurringExpense.update({ where: { id }, data });
  } else {
    await db.recurringExpense.create({ data: { ...data, businessId: business.id } });
  }
  revalidatePath("/app/expenses/recurring");
  redirect("/app/expenses/recurring");
}

export async function setRecurringExpenseStatus(form: FormData) {
  const { business } = await requireBusiness();
  const status = str(form, "status");
  if (!["ACTIVE", "PAUSED", "ENDED"].includes(status)) return;
  const r = await db.recurringExpense.findFirst({ where: { id: str(form, "id"), businessId: business.id } });
  if (!r) return;
  let nextRunAt = r.nextRunAt;
  if (status === "ACTIVE") while (nextRunAt < new Date(new Date().toDateString())) nextRunAt = advance(nextRunAt, r.frequency);
  await db.recurringExpense.update({ where: { id: r.id }, data: { status, nextRunAt } });
  revalidatePath("/app/expenses/recurring");
}
