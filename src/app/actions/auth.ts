"use server";

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { createSession, deleteSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrors, randomToken } from "@/lib/utils";
import { escapeHtml, layout, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import type { FormState } from "@/components/form-bits";
import { TERMS_VERSION } from "@/lib/legal";
import { clientIp, recent, record } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/verify-email";

const SignupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name."),
  email: z.email("Enter a valid email address, like name@example.com.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters."),
  terms: z.literal("on", "You need to agree to the Terms of Service and Privacy Policy to create an account."),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const raw = {
    fullName: String(form.get("fullName") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    terms: (form.get("terms") as string) || undefined,
  };
  const values = { fullName: raw.fullName, email: raw.email };
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values };

  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email } })) {
    return { errors: { email: "There's already an account with this email. Log in instead." }, values };
  }
  let userId: string;
  try {
    ({ id: userId } = await db.user.create({
      data: {
        email: d.email, fullName: d.fullName, passwordHash: await bcrypt.hash(d.password, 10), termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION,
        signupRef: String(form.get("ref") ?? "").slice(0, 40) || null,
      },
      select: { id: true },
    }));
  } catch (e) {
    // A double-submitted form: the first request already created this account.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: "There's already an account with this email. Log in instead." }, values };
    }
    throw e;
  }
  await createSession({ userId });
  // Confirms they own the address before BizBooks emails invoices or takes payments in the business's name.
  await sendVerificationEmail({ id: userId, email: d.email, fullName: d.fullName }, "/app").catch(() => null);
  redirect("/onboarding");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  // Slow down password guessing: 5 wrong tries on one account, or 20 from one address, in 15 minutes.
  const ip = await clientIp();
  if ((await recent("LOGIN_FAIL_EMAIL", email, 15)) >= 5 || (await recent("LOGIN_FAIL_IP", ip, 15)) >= 20) {
    return { message: "Too many attempts. Wait 15 minutes and try again, or reset your password.", values: { email } };
  }
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  // Same message either way, so the form doesn't reveal which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await Promise.all([record("LOGIN_FAIL_EMAIL", email), record("LOGIN_FAIL_IP", ip)]);
    return { message: "That email and password don't match. Check them and try again.", values: { email } };
  }
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await createSession({ userId: user.id });
  redirect(next.startsWith("/app") || next.startsWith("/admin") || next.startsWith("/invite/") || next === "/accountant" ? next : "/app");
}

/** Ends every session on every device, then signs this device back in so the owner isn't thrown out too. */
export async function signOutEverywhere() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db.user.update({ where: { id: user.id }, data: { sessionsRevokedAt: new Date() } });
  await createSession({ userId: user.id });
  redirect("/app/settings?signedOut=1");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}

const RESET_TTL_MINUTES = 60;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Email a one-time reset link. Always answers the same way, so the form can't be used to find out
 * which emails have accounts. At most 3 links per account per hour.
 */
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { errors: { email: "Enter a valid email address, like name@example.com." }, values: { email } };
  const done: FormState = { ok: true, message: `If there's an account for ${email}, we've emailed a link to reset the password. It works for ${RESET_TTL_MINUTES} minutes. Check your spam folder if it doesn't arrive in a few minutes.` };

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return done;
  const recent = await db.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= 3) return done;

  const token = randomToken(32);
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) } });
  const link = new URL(`/reset-password?token=${encodeURIComponent(token)}`, siteUrl()).toString();
  const { html, text } = layout({
    heading: "Reset your BizBooks password",
    preview: `This link works for ${RESET_TTL_MINUTES} minutes.`,
    paragraphs: [
      `Hi ${escapeHtml(user.fullName.split(" ")[0])}, someone (hopefully you) asked to reset the password for ${escapeHtml(email)}.`,
      `The link works once, for the next ${RESET_TTL_MINUTES} minutes. Resetting signs you out on your other devices.`,
    ],
    button: { label: "Choose a new password", href: link },
    after: ["Didn't ask for this? Ignore this email and your password stays the same."],
  });
  await sendEmail({ to: email, subject: "Reset your BizBooks password", html, text });
  return done;
}

async function validReset(token: string) {
  if (!token) return null;
  const r = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  return r && !r.usedAt && r.expiresAt > new Date() ? r : null;
}

/** Used by the reset page to show a friendly "link expired" state before the form. */
export async function resetTokenIsValid(token: string) {
  return !!(await validReset(token));
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { errors: { password: "Use at least 8 characters." } };
  if (password !== confirm) return { errors: { confirm: "The two passwords don't match." } };

  const reset = await validReset(token);
  if (!reset) return { message: "This reset link has expired or was already used. Request a new one." };
  const now = new Date();
  // Use the link, kill any other open links, change the password and sign out old sessions, all at once.
  const claimed = await db.$transaction(async (tx) => {
    const used = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
    if (used.count !== 1) return false;
    await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
    // The reset link reached their inbox, which also confirms the email address.
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: now, lastSeenAt: now, emailVerifiedAt: now } });
    return true;
  });
  if (!claimed) return { message: "This reset link was already used. Request a new one." };
  await createSession({ userId: reset.userId });
  redirect("/app?reset=1");
}
