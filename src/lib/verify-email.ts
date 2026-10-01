import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";

/*
  Email verification: a signed, short-lived link proves the person receives mail at the address.
  Stateless (signed with SESSION_SECRET), and bound to the address it was sent to, so changing the
  account's email makes old links useless.
*/

const TTL_HOURS = 24;
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function sendVerificationEmail(user: { id: string; email: string; fullName: string }, next = "/app") {
  const token = await new SignJWT({ purpose: "verify-email", userId: user.id, email: user.email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(key());
  const link = new URL("/verify-email", siteUrl());
  link.searchParams.set("token", token);
  if (next.startsWith("/")) link.searchParams.set("next", next);
  const { html, text } = layout({
    heading: "Confirm your email address",
    preview: `This link works for ${TTL_HOURS} hours.`,
    paragraphs: [
      `Hi ${esc(user.fullName.split(" ")[0])}, confirm that ${esc(user.email)} is your address to finish signing in.`,
      "Didn't ask for this? You can ignore this email.",
    ],
    button: { label: "Confirm my email", href: link.toString() },
  });
  return sendEmail({ to: user.email, subject: "Confirm your BizBooks email address", html, text });
}

/** Marks the address verified when the token is valid and still matches the account's email. */
export async function verifyEmailToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== "verify-email" || typeof payload.userId !== "string" || typeof payload.email !== "string") return false;
    const done = await db.user.updateMany({
      where: { id: payload.userId, email: payload.email },
      data: { emailVerifiedAt: new Date() },
    });
    return done.count === 1;
  } catch {
    return false;
  }
}
