"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { logAdmin, requireAdmin } from "@/lib/admin";
import { qualify } from "@/lib/growth";
import { str } from "@/lib/utils";

/** Pro businesses can choose to show the "Sent with BizBooks" referral line on their invoices. */
export async function setReferralFooter(form: FormData) {
  const { business } = await requireBusiness();
  await db.business.update({ where: { id: business.id }, data: { showReferralFooter: str(form, "on") === "1" } });
  revalidatePath("/app/refer");
}

/** Admin override for edge cases: approve a genuine referral the rules rejected, or reject a suspicious one. */
export async function adminReferralDecision(form: FormData) {
  const admin = await requireAdmin();
  const ref = await db.referral.findUnique({ where: { id: str(form, "id") }, include: { referred: { select: { name: true } } } });
  if (!ref) return;
  if (str(form, "decision") === "approve" && ref.status !== "QUALIFIED") {
    await qualify(ref.id, { byAdmin: true });
    await logAdmin(admin.email, "REFERRAL_APPROVE", ref.referrerId, `Referral of ${ref.referred.name}`);
  } else if (str(form, "decision") === "reject" && ref.status === "PENDING") {
    const reason = str(form, "note") || "Rejected by BizBooks";
    await db.referral.update({ where: { id: ref.id }, data: { status: "REJECTED", reason } });
    await logAdmin(admin.email, "REFERRAL_REJECT", ref.referrerId, `Referral of ${ref.referred.name}: ${reason}`);
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/businesses/${ref.referrerId}`);
}
