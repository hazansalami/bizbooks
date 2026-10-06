import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";
import { importLines, type StatementLine } from "./bank";
import { siteUrl } from "./site-url";
import { addDays } from "./utils";

/*
  Bank feeds through Mono (mono.co). Off unless MONO_SECRET_KEY is set.
  Linking: we ask Mono for a hosted link (POST /v2/accounts/initiate) and send the owner there; Mono tells us
  the account id by webhook (mono.events.account_connected), matched to the business by our `ref`.
  Syncing: GET /v2/accounts/{id}/transactions, daily from the cron and right after linking.
  Amounts from Mono are in kobo.
*/

const API = "https://api.withmono.com";

export const monoConfigured = () => !!process.env.MONO_SECRET_KEY;

async function mono<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "mono-sec-key": process.env.MONO_SECRET_KEY!, accept: "application/json", "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mono ${res.status}: ${(body as { message?: string }).message ?? "request failed"}`);
  return body as T;
}

/** Starts linking a bank account: returns the Mono page to send the owner to. */
export async function startMonoLink(business: { id: string; name: string }, ownerEmail: string) {
  const ref = `bb_${randomBytes(12).toString("hex")}`;
  await db.bankConnection.create({ data: { businessId: business.id, ref } });
  const r = await mono<{ data: { mono_url: string } }>("/v2/accounts/initiate", {
    method: "POST",
    body: JSON.stringify({
      customer: { name: business.name, email: ownerEmail },
      meta: { ref },
      scope: "auth",
      redirect_url: new URL("/app/bank?linked=1", siteUrl()).toString(),
    }),
  });
  return r.data.mono_url;
}

/** Mono signs webhooks with the secret set on the dashboard, sent back in this header. */
export function verifyMonoWebhook(header: string | null) {
  const secret = process.env.MONO_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type MonoTx = { id: string; narration: string; amount: number; type: string; balance?: number | null; date: string };

const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

/** Pulls new lines for one linked account (from a few days before the last sync, so nothing slips between runs). */
export async function syncConnection(connectionId: string) {
  const c = await db.bankConnection.findUnique({ where: { id: connectionId } });
  if (!c?.accountId || c.status === "DISCONNECTED") return { added: 0 };
  const start = c.lastSyncedAt ? addDays(c.lastSyncedAt, -3) : addDays(new Date(), -90);
  try {
    const r = await mono<{ data: MonoTx[] }>(`/v2/accounts/${encodeURIComponent(c.accountId)}/transactions?paginate=false&start=${ddmmyyyy(start)}&end=${ddmmyyyy(new Date())}`);
    const lines: StatementLine[] = (r.data ?? []).filter((t) => t.id && t.date && Number(t.amount) > 0).map((t) => ({
      externalId: t.id,
      date: new Date(t.date),
      description: (t.narration || "No description").slice(0, 300),
      amount: (String(t.type).toLowerCase().startsWith("debit") ? -1 : 1) * Math.round(Number(t.amount)) / 100,
      balance: t.balance != null ? Number(t.balance) / 100 : null,
    }));
    const res = await importLines(c.businessId, lines, { source: "MONO", account: c.label, connectionId: c.id });
    await db.bankConnection.update({ where: { id: c.id }, data: { lastSyncedAt: new Date(), lastError: null, status: "ACTIVE" } });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 401/403 here usually means the owner must re-authorise the account with their bank.
    await db.bankConnection.update({ where: { id: c.id }, data: { lastError: msg.slice(0, 300), status: /Mono 40[13]/.test(msg) ? "REAUTH" : c.status } });
    throw e;
  }
}

/** Account linked: store Mono's account id, label it, and pull the first 90 days. */
export async function onAccountConnected(ref: string, accountId: string) {
  const c = await db.bankConnection.findUnique({ where: { ref } });
  if (!c) return false;
  let label: string | null = null;
  try {
    const d = await mono<{ data: { account?: { institution?: { name?: string }; account_number?: string; name?: string } } }>(`/v2/accounts/${encodeURIComponent(accountId)}`);
    const a = d.data.account;
    label = [a?.institution?.name, a?.account_number ? `••${a.account_number.slice(-4)}` : null].filter(Boolean).join(" ") || null;
  } catch {
    // The label is a nicety; the link still works without it.
  }
  await db.bankConnection.update({ where: { id: c.id }, data: { accountId, status: "ACTIVE", label } });
  await syncConnection(c.id).catch(() => null);
  return true;
}

export async function unlinkConnection(connectionId: string) {
  const c = await db.bankConnection.findUnique({ where: { id: connectionId } });
  if (!c) return;
  if (c.accountId && monoConfigured()) await mono(`/v2/accounts/${encodeURIComponent(c.accountId)}/unlink`, { method: "POST" }).catch(() => null);
  await db.bankConnection.update({ where: { id: c.id }, data: { status: "DISCONNECTED" } });
}

/** Daily: every active feed. */
export async function syncAllConnections() {
  if (!monoConfigured()) return { synced: 0, failed: 0 };
  const all = await db.bankConnection.findMany({ where: { status: "ACTIVE", accountId: { not: null } }, select: { id: true } });
  let synced = 0, failed = 0;
  for (const c of all) {
    try { await syncConnection(c.id); synced++; } catch { failed++; }
  }
  // Links started but never finished are dropped after a day.
  await db.bankConnection.deleteMany({ where: { status: "PENDING", createdAt: { lt: addDays(new Date(), -1) } } });
  return { synced, failed };
}
