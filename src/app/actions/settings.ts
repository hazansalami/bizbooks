"use server";

import { grantTrialBonus } from "@/lib/growth";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, requireOwner } from "@/lib/auth";
import { addBankAccount, NUBAN, saveGateway } from "@/lib/business";
import { str } from "@/lib/utils";
import { templateId } from "@/lib/invoice-templates";
import type { FormState } from "@/components/form-bits";

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const values = Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === "string" && k !== "logo")) as Record<string, string>;
  const errors: Record<string, string> = {};
  const name = str(form, "name");
  if (name.length < 2) errors.name = "Enter your business name.";
  const email = str(form, "email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "That email doesn't look right.";
  const prefix = str(form, "invoicePrefix").toUpperCase();
  if (!/^[A-Z0-9-]{1,8}$/.test(prefix)) errors.invoicePrefix = "Use up to 8 letters or numbers.";
  const vatRate = Number(str(form, "vatRate") || "7.5");
  if (!(vatRate >= 0 && vatRate <= 30)) errors.vatRate = "Enter a VAT rate between 0 and 30.";
  const logo = str(form, "logo");
  if (logo && (!logo.startsWith("data:image/") || logo.length > 280_000)) errors.logo = "Use a PNG or JPG under 200 KB.";
  if (Object.keys(errors).length) return { errors, values };

  const terms = Number(str(form, "paymentTermsDays"));
  const payDay = Math.round(Number(str(form, "payDay")));
  const entityType = str(form, "entityType");
  const color = str(form, "brandColor");
  await db.business.update({
    where: { id: business.id },
    data: {
      name, legalName: str(form, "legalName") || null, rcNumber: str(form, "rcNumber") || null,
      entityType: ["LTD", "BN", "PARTNERSHIP", "SOLE", "NGO"].includes(entityType) ? entityType : business.entityType,
      professionalServices: str(form, "professionalServices") === "on",
      payDay: payDay >= 1 && payDay <= 31 ? payDay : business.payDay,
      email: email || null, phone: str(form, "phone") || null, address: str(form, "address") || null,
      city: str(form, "city") || null, state: str(form, "state") || null, tin: str(form, "tin") || null,
      vatRegistered: str(form, "vatRegistered") === "on", vatRate,
      invoicePrefix: prefix, paymentTermsDays: [0, 7, 14, 30].includes(terms) ? terms : business.paymentTermsDays,
      invoiceFooter: str(form, "invoiceFooter") || null, autoReminders: str(form, "autoReminders") === "on", weeklyDigest: str(form, "weeklyDigest") === "on",
      // Only changed when the box is on the form (it's disabled until WhatsApp is connected).
      ...(form.get("whatsappRemindersShown") ? { whatsappReminders: str(form, "whatsappReminders") === "on" } : {}),
      logo: logo || null, brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : business.brandColor,
    },
  });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved. New invoices will use these details." };
}

export async function addBankAction(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireOwner();
  const a = { bankName: str(form, "bankName"), accountNumber: str(form, "accountNumber").replace(/\s/g, ""), accountName: str(form, "accountName") };
  const errors: Record<string, string> = {};
  if (!a.bankName) errors.bankName = "Choose the bank.";
  if (!NUBAN.test(a.accountNumber)) errors.accountNumber = "Nigerian account numbers have 10 digits.";
  if (a.accountName.length < 2) errors.accountName = "Enter the account name.";
  if (Object.keys(errors).length) return { errors, values: a };
  await addBankAccount(business.id, a);
  revalidatePath("/app/settings/payments");
  return { ok: true, message: "Bank account added." };
}

export async function bankAction(form: FormData) {
  const { business } = await requireOwner();
  const id = str(form, "id");
  const acct = await db.bankAccount.findFirst({ where: { id, businessId: business.id } });
  if (!acct) return;
  if (str(form, "op") === "default") {
    await db.$transaction([
      db.bankAccount.updateMany({ where: { businessId: business.id }, data: { isDefault: false } }),
      db.bankAccount.update({ where: { id }, data: { isDefault: true } }),
    ]);
  } else {
    await db.bankAccount.delete({ where: { id } });
    if (acct.isDefault) {
      const next = await db.bankAccount.findFirst({ where: { businessId: business.id } });
      if (next) await db.bankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  revalidatePath("/app/settings/payments");
}

export async function connectGatewayAction(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireOwner();
  const provider = str(form, "provider") === "FLUTTERWAVE" ? "FLUTTERWAVE" : "PAYSTACK";
  const secretKey = str(form, "secretKey");
  if (!secretKey) return { errors: { secretKey: "Paste your secret key." }, values: { provider } };
  const r = await saveGateway(business.id, { provider, secretKey, publicKey: str(form, "publicKey"), webhookHash: str(form, "webhookHash") });
  if (!r.ok) return { errors: { secretKey: r.error }, values: { provider } };
  await grantTrialBonus(business.id, "GET_PAID");
  revalidatePath("/app/settings/payments");
  return { ok: true, message: `${r.name} connected${r.mode === "TEST" ? " in test mode. Switch to your live key before sending real invoices" : ""}.` };
}

export async function gatewayAction(form: FormData) {
  const { business } = await requireOwner();
  const g = await db.gateway.findFirst({ where: { id: str(form, "id"), businessId: business.id } });
  if (!g) return;
  const op = str(form, "op");
  if (op === "remove") await db.gateway.delete({ where: { id: g.id } });
  else await db.gateway.update({ where: { id: g.id }, data: { enabled: op === "enable" } });
  revalidatePath("/app/settings/payments");
}

export async function saveInvoiceTemplate(form: FormData) {
  const { business } = await requireBusiness();
  await db.business.update({ where: { id: business.id }, data: { invoiceTemplate: templateId(str(form, "template")) } });
  revalidatePath("/app/settings/invoice-style");
}
