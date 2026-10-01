"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAdmin, requireAdmin } from "@/lib/admin";
import { addDays, addMonths, formatDate, str } from "@/lib/utils";

async function business(id: string) {
  return db.business.findUnique({ where: { id } });
}

function done(id: string) {
  revalidatePath(`/admin/businesses/${id}`);
  revalidatePath("/admin");
}

/** Give Pro time without a payment (partners, support credits, pilots). Adds to any time already paid. */
export async function grantPro(form: FormData) {
  const admin = await requireAdmin();
  const b = await business(str(form, "id"));
  if (!b) return;
  const months = Math.min(36, Math.max(1, Number(str(form, "months")) || 1));
  const start = b.plan === "PRO" && b.proUntil && b.proUntil > new Date() ? b.proUntil : new Date();
  const until = addMonths(start, months);
  await db.business.update({ where: { id: b.id }, data: { plan: "PRO", proUntil: until, cancelAtEnd: false, renewalNoticeAt: null } });
  await logAdmin(admin.email, "GRANT_PRO", b.id, `${months} month${months === 1 ? "" : "s"}, until ${formatDate(until)}${str(form, "note") ? `. ${str(form, "note")}` : ""}`);
  done(b.id);
}

export async function revokePro(form: FormData) {
  const admin = await requireAdmin();
  const b = await business(str(form, "id"));
  if (!b) return;
  await db.business.update({ where: { id: b.id }, data: { plan: "FREE", proUntil: null, paidUntil: null, cancelAtEnd: false, pausedUntil: null } });
  await logAdmin(admin.email, "REVOKE_PRO", b.id, str(form, "note") || undefined);
  done(b.id);
}

export async function clearCancel(form: FormData) {
  const admin = await requireAdmin();
  const b = await business(str(form, "id"));
  if (!b) return;
  await db.business.update({ where: { id: b.id }, data: { cancelAtEnd: false } });
  await logAdmin(admin.email, "CLEAR_CANCEL", b.id);
  done(b.id);
}

export async function endPause(form: FormData) {
  const admin = await requireAdmin();
  const b = await business(str(form, "id"));
  if (!b) return;
  // Like the owner resuming: the unused part of the pause comes back off the end date.
  const now = new Date();
  const unused = b.pausedUntil && b.pausedUntil > now ? Math.round((b.pausedUntil.getTime() - now.getTime()) / 86400000) : 0;
  await db.business.update({ where: { id: b.id }, data: { pausedUntil: null, proUntil: b.proUntil ? addDays(b.proUntil, -unused) : null } });
  await logAdmin(admin.email, "END_PAUSE", b.id, unused ? `${unused} unused day${unused === 1 ? "" : "s"} taken off the end date` : undefined);
  done(b.id);
}

export async function addNote(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const note = str(form, "note").slice(0, 1000);
  if (!note || !(await business(id))) return;
  await logAdmin(admin.email, "NOTE", id, note);
  done(id);
}

const ADVISOR_STATUSES = ["NEW", "CONTACTED", "WON", "LOST"];

export async function setAdvisorStatus(form: FormData) {
  const admin = await requireAdmin();
  const status = str(form, "status");
  if (!ADVISOR_STATUSES.includes(status)) return;
  const r = await db.advisorRequest.update({ where: { id: str(form, "id") }, data: { status } }).catch(() => null);
  if (!r) return;
  await logAdmin(admin.email, "ADVISOR_STATUS", r.businessId, `${r.companyName}: ${status}`);
  revalidatePath("/admin");
}
