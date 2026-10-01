import "server-only";
import { db } from "./db";
import { addMonths } from "./utils";
import { isPro, isTrial } from "./plan";

/** Idempotent: a second call for the same payment (redirect + webhook) changes nothing. */
export async function activatePro(platformPaymentId: string) {
  await db.$transaction(async (tx) => {
    const updated = await tx.platformPayment.updateMany({ where: { id: platformPaymentId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
    if (updated.count === 0) return;
    const p = await tx.platformPayment.findUniqueOrThrow({ where: { id: platformPaymentId } });
    const b = await tx.business.findUniqueOrThrow({ where: { id: p.businessId } });
    const now = new Date();
    // Renewing early adds to the time left; renewing late starts from today.
    const base = b.proUntil && b.proUntil > now ? b.proUntil : now;
    const proUntil = addMonths(base, p.months);
    // Paid time runs to the new end date; that's what turns the BizBooks line off their invoices.
    await tx.business.update({
      where: { id: b.id },
      data: { plan: "PRO", proUntil, paidUntil: proUntil, cancelAtEnd: false, renewalNoticeAt: null },
    });
  });
}

type OfferBusiness = Parameters<typeof isPro>[0] & { id: string };

/**
 * Save offers (a discount or a pause) are for running, non-trial Pro plans, and each one only once:
 * repeating them (a pause on top of a pause, or a fresh discount every few months) would mint free time.
 */
export async function saveOfferAllowed(b: OfferBusiness, offer: "DISCOUNT" | "PAUSE", now = new Date()) {
  if (!isPro(b, now) || isTrial(b) || (b.pausedUntil && b.pausedUntil > now)) return false;
  return (await db.cancellationFeedback.count({ where: { businessId: b.id, outcome: `SAVED_${offer}` } })) === 0;
}
