"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { logAdmin, requireAdmin } from "@/lib/admin";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { str } from "@/lib/utils";
import { accountMatchesBusiness, createSubaccount, listBanks, paymentsEnabled, resolveAccount, updateSubaccount } from "@/lib/platform-payments";
import type { FormState } from "@/components/form-bits";

async function bankFrom(form: FormData) {
  const code = str(form, "bankCode");
  return (await listBanks()).find((b) => b.code === code) ?? null;
}

/** Step 1 in settings: look up the account name so the owner can confirm it's theirs. */
export async function checkBankAccount(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const accountNumber = str(form, "accountNumber").replace(/\D/g, "");
  const values = { bankCode: str(form, "bankCode"), accountNumber };
  const bank = await bankFrom(form);
  if (!bank) return { errors: { bankCode: "Choose your bank." }, values };
  const r = await resolveAccount(accountNumber, bank.code, business.legalName || business.name);
  if (!r.ok) return { errors: { accountNumber: r.error }, values };
  const matches = accountMatchesBusiness(r.accountName, [business.legalName, business.name]);
  return { ok: true, values: { ...values, accountName: r.accountName, matches: matches ? "yes" : "no" } };
}

async function notifyOwner(businessId: string, subject: string, paragraphs: string[]) {
  const b = await db.business.findUnique({ where: { id: businessId }, include: { owner: true } });
  if (!b) return;
  const { html, text } = layout({ heading: subject, paragraphs, button: { label: "Review payment settings", href: new URL("/app/settings/payments", siteUrl()).toString() } });
  await sendEmail({ to: b.owner.email, subject, html, text });
}

/**
 * Step 2: turn on BizBooks Payments, or change the payout account. A matching business account goes live at
 * once; anything else waits for a person to review it, so settlements can't be quietly redirected.
 */
export async function activatePayments(_: FormState, form: FormData): Promise<FormState> {
  const { business, user } = await requireBusiness();
  const values = { bankCode: str(form, "bankCode"), accountNumber: str(form, "accountNumber").replace(/\D/g, "") };
  if (!paymentsEnabled()) return { message: "BizBooks Payments isn't available yet.", values };
  if (!business.rcNumber) return { message: "Add your CAC number (RC or BN) under Settings first. BizBooks Payments is for registered businesses.", values };
  if (str(form, "terms") !== "on") return { errors: { terms: "Please agree to the BizBooks Payments terms and fee." }, values };
  const bank = await bankFrom(form);
  if (!bank) return { errors: { bankCode: "Choose your bank." }, values };
  const r = await resolveAccount(values.accountNumber, bank.code, business.legalName || business.name);
  if (!r.ok) return { errors: { accountNumber: r.error }, values };

  const matches = accountMatchesBusiness(r.accountName, [business.legalName, business.name]);
  const existing = await db.paymentAccount.findUnique({ where: { businessId: business.id } });
  const details = { bankCode: bank.code, bankName: bank.name, accountNumber: values.accountNumber, accountName: r.accountName };
  const displayName = business.legalName || business.name;

  let status = "PENDING_REVIEW";
  let subaccountCode = existing?.subaccountCode ?? null;
  let reviewNote: string | null = matches ? null : `Account name "${r.accountName}" doesn't match "${displayName}".`;
  if (matches) {
    const s = subaccountCode
      ? await updateSubaccount(subaccountCode, { ...details, businessName: displayName })
      : await createSubaccount({ ...details, businessName: displayName, email: business.email || user.email, businessId: business.id });
    if (!s.ok) return { message: s.error, values };
    subaccountCode = s.code;
    status = "ACTIVE";
    reviewNote = null;
  }

  const clearPending = { pendingBankCode: null, pendingBankName: null, pendingAccountNumber: null, pendingAccountName: null };
  if (!matches && existing?.subaccountCode) {
    // Changing a live, verified account to one that doesn't match: keep the verified details (Paystack still
    // settles there) and hold the new ones for review. Payments pause until a person approves the change.
    await db.paymentAccount.update({
      where: { id: existing.id },
      data: {
        pendingBankCode: details.bankCode, pendingBankName: details.bankName, pendingAccountNumber: details.accountNumber, pendingAccountName: details.accountName,
        status, reviewNote, termsAcceptedAt: new Date(),
      },
    });
  } else {
    await db.paymentAccount.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...details, subaccountCode, status, reviewNote, termsAcceptedAt: new Date() },
      update: { ...details, ...clearPending, subaccountCode, status, reviewNote, termsAcceptedAt: new Date() },
    });
  }
  const acct = `${esc(bank.name)} account ending ${values.accountNumber.slice(-4)}`;
  await notifyOwner(business.id,
    status === "ACTIVE" ? (existing ? "Your payout account was changed" : "BizBooks Payments is on") : "We're reviewing your payout account",
    status === "ACTIVE"
      ? [`Card, transfer and USSD payments on your invoices will now settle to your ${acct} (${esc(r.accountName)}).`, "If you didn't make this change, reply to this email straight away."]
      : [`The account name for your ${acct} is ${esc(r.accountName)}, which doesn't match ${esc(displayName)}. We check these by hand to keep your money safe, usually within one working day.`, "If you didn't make this change, reply to this email straight away."]);
  revalidatePath("/app/settings/payments");
  return status === "ACTIVE"
    ? { ok: true, message: existing ? "Payout account updated." : "BizBooks Payments is on. Your invoices now have a “Pay now” button." }
    : { ok: true, message: "Thanks. That account name doesn't exactly match your business, so we'll check it by hand, usually within one working day. Clients can still pay by bank transfer meanwhile." };
}

export async function setPaymentsOn(form: FormData) {
  const { business } = await requireBusiness();
  const a = await db.paymentAccount.findUnique({ where: { businessId: business.id } });
  if (!a) return;
  const on = str(form, "on") === "1";
  if (on && a.status === "DISABLED" && a.subaccountCode) await db.paymentAccount.update({ where: { id: a.id }, data: { status: "ACTIVE" } });
  if (!on && a.status === "ACTIVE") await db.paymentAccount.update({ where: { id: a.id }, data: { status: "DISABLED" } });
  revalidatePath("/app/settings/payments");
}

/* ---------- Admin ---------- */

export async function adminReviewPaymentAccount(form: FormData) {
  const admin = await requireAdmin();
  const a = await db.paymentAccount.findUnique({ where: { id: str(form, "id") }, include: { business: { include: { owner: true } } } });
  if (!a) return;
  const decision = str(form, "decision");
  const b = a.business;
  const displayName = b.legalName || b.name;
  const pending = a.pendingBankCode && a.pendingAccountNumber
    ? { bankCode: a.pendingBankCode, bankName: a.pendingBankName ?? "", accountNumber: a.pendingAccountNumber, accountName: a.pendingAccountName ?? "" }
    : null;
  const clearPending = { pendingBankCode: null, pendingBankName: null, pendingAccountNumber: null, pendingAccountName: null };
  if (decision === "approve") {
    const target = pending ?? { bankCode: a.bankCode, bankName: a.bankName, accountNumber: a.accountNumber, accountName: a.accountName };
    const s = a.subaccountCode
      ? await updateSubaccount(a.subaccountCode, { bankCode: target.bankCode, accountNumber: target.accountNumber, businessName: displayName })
      : await createSubaccount({ bankCode: target.bankCode, accountNumber: target.accountNumber, businessName: displayName, email: b.email || b.owner.email, businessId: b.id });
    if (!s.ok) {
      await db.paymentAccount.update({ where: { id: a.id }, data: { reviewNote: `Paystack error: ${s.error}` } });
    } else {
      await db.paymentAccount.update({ where: { id: a.id }, data: { ...target, ...clearPending, status: "ACTIVE", reviewNote: null, subaccountCode: s.code } });
      await notifyOwner(b.id, "BizBooks Payments is on", [`We've checked your ${esc(target.bankName)} account ending ${target.accountNumber.slice(-4)}. Payments now settle there.`]);
    }
    await logAdmin(admin.email, "PAYMENTS_APPROVE", b.id, `${target.bankName} ••${target.accountNumber.slice(-4)} (${target.accountName})`);
  } else if (decision === "reject" && pending && a.subaccountCode) {
    // Rejected change: the verified account stays, and payments resume on it.
    const note = str(form, "note") || "The new account doesn't belong to the business.";
    await db.paymentAccount.update({ where: { id: a.id }, data: { ...clearPending, status: "ACTIVE", reviewNote: null } });
    await notifyOwner(b.id, "We couldn't approve your new payout account", [esc(note), `Payments keep settling to your ${esc(a.bankName)} account ending ${a.accountNumber.slice(-4)}.`]);
    await logAdmin(admin.email, "PAYMENTS_REJECT", b.id, `Change to ${pending.bankName} ••${pending.accountNumber.slice(-4)} rejected: ${note}`);
  } else if (decision === "reject" || decision === "suspend") {
    const note = str(form, "note") || (decision === "reject" ? "Account doesn't belong to the business." : "Suspended by BizBooks.");
    await db.paymentAccount.update({ where: { id: a.id }, data: { status: decision === "reject" ? "DISABLED" : "SUSPENDED", reviewNote: note } });
    await notifyOwner(b.id, decision === "reject" ? "We couldn't approve your payout account" : "BizBooks Payments is paused on your account",
      [esc(note), "Reply to this email if you have questions. Clients can still pay you by bank transfer."]);
    await logAdmin(admin.email, decision === "reject" ? "PAYMENTS_REJECT" : "PAYMENTS_SUSPEND", b.id, note);
  } else if (decision === "credits") {
    const n = Math.min(100, Math.max(1, Number(str(form, "count")) || 5));
    await db.paymentAccount.update({ where: { id: a.id }, data: { feeFreeLeft: { increment: n } } });
    await logAdmin(admin.email, "PAYMENTS_FEE_FREE", b.id, `+${n} fee-free payments`);
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/businesses/${b.id}`);
}
