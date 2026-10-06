import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "bb_session";
const MAX_AGE_DAYS = 30;

/** issuedAt (ms) comes back from decrypt; it lets a password change sign out older sessions. */
export type SessionPayload = { userId: string; issuedAt?: number };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { userId: String(payload.userId), issuedAt: typeof payload.iat === "number" ? payload.iat * 1000 : 0 };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await encrypt(payload);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

export async function readSession() {
  const store = await cookies();
  return decrypt(store.get(COOKIE)?.value);
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE);
  // Which business an accountant was working in belongs to that sign-in too.
  store.delete("bb_business");
}

export const SESSION_COOKIE = COOKIE;
