import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/** The caller's IP as Vercel reports it (first x-forwarded-for entry). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** How many times this happened in the last `windowMinutes`. */
export async function recent(kind: string, key: string, windowMinutes: number) {
  return db.rateEvent.count({ where: { kind, key, createdAt: { gt: new Date(Date.now() - windowMinutes * 60_000) } } });
}

export async function record(kind: string, key: string) {
  await db.rateEvent.create({ data: { kind, key } });
}

/** Rows older than a day are never counted; the daily job clears them. */
export async function clearOldRateEvents() {
  return (await db.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } })).count;
}
