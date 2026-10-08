"use server";

import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACTIVE_BUSINESS_COOKIE, getCurrentUser, requireOwner, requireUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { randomToken, str } from "@/lib/utils";
import { TERMS_VERSION } from "@/lib/legal";
import type { FormState } from "@/components/form-bits";

const INVITE_DAYS = 7;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function setActiveBusiness(businessId: string) {
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

/** The owner invites their accountant by email. The link works once, for 7 days. */
export async function inviteAccountant(_: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireOwner();
  const email = str(form, "email").toLowerCase();
  if (!z.email().safeParse(email).success) return { errors: { email: "Enter your accountant's email address." }, values: { email } };
  if (email === user.email.toLowerCase()) return { errors: { email: "That's your own email. Enter your accountant's." }, values: { email } };
  const existing = await db.membership.findFirst({ where: { businessId: business.id, user: { email } } });
  if (existing) return { errors: { email: "They already have access." }, values: { email } };
  const pending = await db.businessInvite.count({ where: { businessId: business.id, acceptedAt: null, expiresAt: { gt: new Date() } } });
  if (pending >= 5) return { message: "You have 5 invitations waiting. Cancel one before sending another.", values: { email } };

  const token = randomToken(24);
  await db.businessInvite.create({ data: { businessId: business.id, email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5) } });
  const link = new URL(`/invite/${token}`, siteUrl()).toString();
  const { html, text } = layout({
    heading: `${business.name} invited you to their books`,
    preview: `${user.fullName} wants you to have accountant access on BizBooks.`,
    paragraphs: [
      `${esc(user.fullName)} has given you accountant access to <strong>${esc(business.legalName || business.name)}</strong> on BizBooks: invoices, payments, expenses, payroll, tax reports and statements, under your own login.`,
      "If you already look after other companies on BizBooks, they all appear in one list when you sign in.",
    ],
    button: { label: "Accept the invitation", href: link },
    after: [`The link works for ${INVITE_DAYS} days. Not expecting this? You can ignore it.`],
  });
  const r = await sendEmail({ to: email, subject: `${business.name} invited you to their books on BizBooks`, html, text, replyTo: user.email });
  revalidatePath("/app/settings/team");
  if (!r.ok) return { message: "The invitation was saved but the email didn't send. Try again in a minute, or cancel it and invite again." };
  return { ok: true, message: `Invitation sent to ${email}.` };
}

export async function cancelInvite(form: FormData) {
  const { business } = await requireOwner();
  await db.businessInvite.deleteMany({ where: { id: str(form, "id"), businessId: business.id, acceptedAt: null } });
  revalidatePath("/app/settings/team");
}

export async function removeMember(form: FormData) {
  const { business } = await requireOwner();
  await db.membership.deleteMany({ where: { id: str(form, "id"), businessId: business.id } });
  revalidatePath("/app/settings/team");
}

async function validInvite(token: string) {
  if (!token) return null;
  const inv = await db.businessInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { business: { select: { id: true, name: true, legalName: true, ownerId: true } } } });
  return inv && !inv.acceptedAt && inv.expiresAt > new Date() ? inv : null;
}

/** For the invite page: who's inviting, or null when the link has expired or been used. */
export async function inviteDetails(token: string) {
  const inv = await validInvite(token);
  return inv ? { email: inv.email, business: inv.business.legalName || inv.business.name } : null;
}

async function grant(userId: string, inv: NonNullable<Awaited<ReturnType<typeof validInvite>>>) {
  if (inv.business.ownerId === userId) return;
  await db.$transaction([
    db.membership.upsert({ where: { userId_businessId: { userId, businessId: inv.businessId } }, create: { userId, businessId: inv.businessId, role: inv.role }, update: {} }),
    db.businessInvite.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
}

/** Signed in already: accept and open the business. */
export async function acceptInvite(form: FormData) {
  const user = await requireUser();
  const token = str(form, "token");
  const inv = await validInvite(token);
  if (!inv) redirect(`/invite/${encodeURIComponent(token)}`);
  await grant(user.id, inv);
  // The link reached this inbox, so it proves the address when it's the account's own.
  if (!user.emailVerifiedAt && user.email.toLowerCase() === inv.email) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await setActiveBusiness(inv.businessId);
  redirect("/app");
}

const AccountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name."),
  password: z.string().min(8, "Use at least 8 characters."),
  terms: z.literal("on", "Please accept the terms to continue."),
});

/** New to BizBooks: create a login for the invited email, accept, and open the business. */
export async function acceptInviteWithSignup(_: FormState, form: FormData): Promise<FormState> {
  if (await getCurrentUser()) return { message: "You're already signed in. Refresh the page to accept with this account." };
  const token = str(form, "token");
  const inv = await validInvite(token);
  if (!inv) return { message: "This invitation has expired or was already used. Ask for a new one." };
  const values = { fullName: str(form, "fullName") };
  const parsed = AccountSchema.safeParse({ fullName: str(form, "fullName"), password: String(form.get("password") ?? ""), terms: str(form, "terms") || undefined });
  if (!parsed.success) return { errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), values };
  if (await db.user.findUnique({ where: { email: inv.email } })) return { message: `There's already a BizBooks account for ${inv.email}. Log in to accept.`, values };
  const user = await db.user.create({
    data: {
      email: inv.email, fullName: parsed.data.fullName, passwordHash: await bcrypt.hash(parsed.data.password, 10),
      termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, emailVerifiedAt: new Date(),
    },
  });
  await grant(user.id, inv);
  await createSession({ userId: user.id });
  await setActiveBusiness(inv.businessId);
  redirect("/app");
}

/** Accountants (and owners who are also someone's accountant) move between businesses. */
export async function switchBusiness(form: FormData) {
  const user = await requireUser();
  const id = str(form, "businessId");
  const ok = user.ownBusiness?.id === id || !!(await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId: id } } }));
  if (ok) await setActiveBusiness(id);
  redirect("/app");
}
