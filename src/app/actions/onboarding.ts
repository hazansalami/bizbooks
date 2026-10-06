"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { addBankAccount, NUBAN, saveGateway } from "@/lib/business";
import { fieldErrors, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";
import { STEPS } from "@/lib/onboarding-steps";
import { PROFESSIONAL_INDUSTRIES } from "@/lib/constants";
import { attachReferral, ensureReferralCode, grantTrialBonus, startTrial } from "@/lib/growth";


async function context() {
  const user = await requireUser();
  return { user, business: user.ownBusiness };
}

function go(step: number) {
  if (step >= STEPS.length) redirect("/onboarding/done");
  redirect(`/onboarding?step=${STEPS[step]}`);
}

async function advance(businessId: string, completed: number) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  if (b.onboardingStep < completed + 1) await db.business.update({ where: { id: businessId }, data: { onboardingStep: completed + 1 } });
}

const BusinessSchema = z.object({
  name: z.string().trim().min(2, "Enter your company's name."),
  entityType: z.enum(["LTD", "BN", "PARTNERSHIP", "SOLE", "NGO"], "Choose how the business is registered."),
  rcNumber: z.string().trim(),
  teamSize: z.string().trim(),
  industry: z.string().trim().min(1, "Pick the closest match. You can change it later."),
  phone: z.string().trim().regex(/^[+\d\s()-]{7,}$/, "Enter a phone number clients can reach you on.").or(z.literal("")),
  email: z.email("Enter a valid email address.").or(z.literal("")),
  state: z.string().trim(),
  city: z.string().trim(),
});

export async function saveBusinessStep(_: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await context();
  const raw = Object.fromEntries(["name", "entityType", "rcNumber", "teamSize", "industry", "phone", "email", "state", "city"].map((k) => [k, str(form, k)]));
  const parsed = BusinessSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values: raw };
  const d = parsed.data;
  const data = {
    name: d.name, entityType: d.entityType, rcNumber: d.rcNumber || null, teamSize: d.teamSize || null, industry: d.industry,
    professionalServices: PROFESSIONAL_INDUSTRIES.includes(d.industry),
    phone: d.phone || null, email: d.email || user.email, state: d.state || null, city: d.city || null,
  };
  if (business) {
    await db.business.update({ where: { id: business.id }, data });
    await advance(business.id, 0);
  } else {
    try {
      const created = await db.$transaction(async (tx) => {
        const b = await tx.business.create({ data: { ...data, ownerId: user.id, onboardingStep: 1 } });
        const [code, source] = (user.signupRef ?? "").split("|");
        const referred = await attachReferral(tx, b.id, user.id, code, source);
        await startTrial(tx, b.id, referred);
        return b;
      });
      await ensureReferralCode(created.id, created.name);
    } catch (e) {
      // A double-submitted first step: the other request already created the business, so carry on.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  go(1);
  return {};
}

export async function saveBankStep(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await context();
  if (!business) redirect("/onboarding");
  if (str(form, "intent") === "skip") {
    await advance(business.id, 1);
    go(2);
  }
  const raw = { bankName: str(form, "bankName"), accountNumber: str(form, "accountNumber").replace(/\s/g, ""), accountName: str(form, "accountName") };
  const errors: Record<string, string> = {};
  if (!raw.bankName) errors.bankName = "Choose your bank.";
  if (!NUBAN.test(raw.accountNumber)) errors.accountNumber = "Nigerian account numbers have 10 digits.";
  if (raw.accountName.length < 2) errors.accountName = "Enter the name on the account, exactly as your bank shows it.";
  if (Object.keys(errors).length) return { errors, values: raw };
  const existing = await db.bankAccount.findFirst({ where: { businessId: business.id, accountNumber: raw.accountNumber } });
  if (!existing) await addBankAccount(business.id, raw);
  await advance(business.id, 1);
  go(2);
  return {};
}

export async function savePaymentsStep(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await context();
  if (!business) redirect("/onboarding");
  if (str(form, "intent") === "skip") {
    await advance(business.id, 2);
    go(3);
  }
  const provider = str(form, "provider") === "FLUTTERWAVE" ? "FLUTTERWAVE" : "PAYSTACK";
  const values = { provider, publicKey: str(form, "publicKey") };
  const secretKey = str(form, "secretKey");
  if (!secretKey) return { errors: { secretKey: "Paste your secret key, or choose “I'll do this later”." }, values };
  const r = await saveGateway(business.id, { provider, secretKey, publicKey: str(form, "publicKey") });
  if (!r.ok) return { errors: { secretKey: r.error }, values };
  await grantTrialBonus(business.id, "GET_PAID");
  await advance(business.id, 2);
  go(3);
  return {};
}

export async function saveTaxStep(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await context();
  if (!business) redirect("/onboarding");
  const terms = Number(str(form, "paymentTermsDays"));
  await db.business.update({
    where: { id: business.id },
    data: {
      vatRegistered: str(form, "vatRegistered") === "yes",
      professionalServices: str(form, "professionalServices") === "yes",
      tin: str(form, "tin") || null,
      paymentTermsDays: [0, 7, 14, 30].includes(terms) ? terms : 30,
    },
  });
  await advance(business.id, 3);
  go(4);
  return {};
}

export async function saveBrandStep(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await context();
  if (!business) redirect("/onboarding");
  if (str(form, "intent") !== "skip") {
    const logo = str(form, "logo");
    const color = str(form, "brandColor");
    if (logo && (!logo.startsWith("data:image/") || logo.length > 280_000)) {
      return { errors: { logo: "Use a PNG or JPG under 200 KB." } };
    }
    await db.business.update({
      where: { id: business.id },
      data: { logo: logo || business.logo, brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : business.brandColor },
    });
  }
  await db.business.update({ where: { id: business.id }, data: { onboardingStep: STEPS.length, onboardedAt: business.onboardedAt ?? new Date() } });
  redirect("/onboarding/done");
}

/** "Skip setup, take me to the app": onboarding can be finished from the dashboard checklist. */
export async function skipOnboarding() {
  const { business } = await context();
  if (!business) redirect("/onboarding");
  await db.business.update({ where: { id: business.id }, data: { onboardedAt: business.onboardedAt ?? new Date() } });
  redirect("/app");
}
