"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { startCheckout } from "@/lib/gateways";
import { renewalPrice } from "@/lib/plan";
import { siteUrl } from "@/lib/site-url";
import { addDays, addMonths, str } from "@/lib/utils";
import { CANCEL_REASONS, MAX_PAUSE_MONTHS, SAVE_OFFER_DISCOUNT, SAVE_OFFER_MONTHS } from "@/lib/constants";

/** Pro is paid with BizBooks' own Paystack account. There are no automatic charges: owners renew when they choose. */
export async function startUpgrade(form: FormData) {
  const { user, business } = await requireBusiness();
  const key = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  if (!key) redirect("/app/settings/billing?error=billing-off");
  const months = str(form, "months") === "12" ? 12 : 1;
  const amount = renewalPrice(business, months);
  const reference = `bbsub-${business.id}-${Date.now().toString(36)}`;
  await db.platformPayment.create({ data: { businessId: business.id, reference, amount, months } });
  const r = await startCheckout("PAYSTACK", key, {
    reference, amount, email: business.email || user.email, customerName: user.fullName,
    callbackUrl: new URL("/api/billing/callback", siteUrl()).toString(),
    businessName: "BizBooks Pro", invoiceNumber: `${months} month${months > 1 ? "s" : ""}`, invoiceId: business.id,
  });
  if ("error" in r) redirect("/app/settings/billing?error=checkout");
  redirect(r.url);
}

const OFFERS = ["DISCOUNT", "PAUSE", "HELP", "FREE"] as const;

export async function cancelReason(form: FormData) {
  await requireBusiness();
  const reason = str(form, "reason");
  if (!CANCEL_REASONS.some((r) => r.value === reason)) redirect("/app/settings/billing/cancel");
  const details = str(form, "details").slice(0, 1000);
  const q = new URLSearchParams({ reason, ...(details ? { details } : {}) });
  // Business closed: don't try to sell them anything. Go straight to a respectful confirmation.
  q.set("step", reason === "CLOSED" ? "confirm" : "offer");
  redirect(`/app/settings/billing/cancel?${q}`);
}

export async function acceptSaveOffer(form: FormData) {
  const { business } = await requireBusiness();
  const offer = str(form, "offer") as (typeof OFFERS)[number];
  const reason = str(form, "reason");
  const details = str(form, "details") || null;
  if (!OFFERS.includes(offer)) redirect("/app/settings/billing");
  const now = new Date();

  if (offer === "DISCOUNT") {
    await db.business.update({ where: { id: business.id }, data: { discountPercent: SAVE_OFFER_DISCOUNT, discountUntil: addMonths(now, SAVE_OFFER_MONTHS), cancelAtEnd: false } });
  }
  if (offer === "PAUSE") {
    const months = Math.min(MAX_PAUSE_MONTHS, Math.max(1, Number(str(form, "months")) || 1));
    const pausedUntil = addMonths(now, months);
    // Paid time doesn't run down while paused: push the end date back by the pause length.
    const pauseDays = Math.round((pausedUntil.getTime() - now.getTime()) / 86400000);
    await db.business.update({
      where: { id: business.id },
      data: { pausedUntil, proUntil: business.proUntil ? addDays(business.proUntil, pauseDays) : null, cancelAtEnd: false },
    });
  }
  if (offer === "FREE") {
    await db.business.update({ where: { id: business.id }, data: { cancelAtEnd: true } });
  }
  await db.cancellationFeedback.create({
    data: { businessId: business.id, reason, details, offer, outcome: offer === "FREE" ? "DOWNGRADED" : `SAVED_${offer}` },
  });
  revalidatePath("/app", "layout");
  redirect(`/app/settings/billing?saved=${offer.toLowerCase()}`);
}

export async function confirmCancel(form: FormData) {
  const { business } = await requireBusiness();
  await db.business.update({ where: { id: business.id }, data: { cancelAtEnd: true } });
  await db.cancellationFeedback.create({
    data: { businessId: business.id, reason: str(form, "reason") || "OTHER", details: str(form, "details") || null, outcome: "CANCELLED" },
  });
  revalidatePath("/app", "layout");
  redirect("/app/settings/billing?cancelled=1");
}

export async function undoCancel() {
  const { business } = await requireBusiness();
  await db.business.update({ where: { id: business.id }, data: { cancelAtEnd: false } });
  revalidatePath("/app/settings/billing");
}

export async function resumeFromPause() {
  const { business } = await requireBusiness();
  if (!business.pausedUntil) return;
  const now = new Date();
  const unused = Math.max(0, Math.round((business.pausedUntil.getTime() - now.getTime()) / 86400000));
  await db.business.update({
    where: { id: business.id },
    data: { pausedUntil: null, proUntil: business.proUntil ? addDays(business.proUntil, -unused) : null },
  });
  revalidatePath("/app", "layout");
}
