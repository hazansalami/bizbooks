"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { fieldErrors } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";
import { TERMS_VERSION } from "@/lib/legal";

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
  const user = await db.user.create({
    data: { email: d.email, fullName: d.fullName, passwordHash: await bcrypt.hash(d.password, 10), termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
  });
  await createSession({ userId: user.id });
  redirect("/onboarding");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  // Same message either way, so the form doesn't reveal which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { message: "That email and password don't match. Check them and try again.", values: { email } };
  }
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await createSession({ userId: user.id });
  redirect(next.startsWith("/app") || next.startsWith("/admin") ? next : "/app");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
