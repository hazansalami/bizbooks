import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { onAccountConnected, syncConnection, verifyMonoWebhook } from "@/lib/mono";

/**
 * Mono bank feed events. Set this URL and a webhook secret (MONO_WEBHOOK_SECRET) on the Mono dashboard.
 *   account_connected → store the account id against the business that started the link (by our ref)
 *   account_updated   → new data is ready: sync that account
 *   account_reauthorisation_required → the owner must reconnect
 */
export async function POST(request: NextRequest) {
  if (!verifyMonoWebhook(request.headers.get("mono-webhook-secret"))) return NextResponse.json({ ok: false }, { status: 401 });
  let event: { event?: string; data?: { id?: string; account?: { _id?: string; id?: string }; meta?: { ref?: string } } };
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const accountId = event.data?.id ?? event.data?.account?._id ?? event.data?.account?.id;
  try {
    if (event.event === "mono.events.account_connected" && event.data?.meta?.ref && accountId) {
      await onAccountConnected(event.data.meta.ref, accountId);
    } else if (event.event === "mono.events.account_updated" && accountId) {
      const c = await db.bankConnection.findUnique({ where: { accountId } });
      if (c) await syncConnection(c.id).catch(() => null);
    } else if (event.event === "mono.events.account_reauthorisation_required" && accountId) {
      await db.bankConnection.updateMany({ where: { accountId }, data: { status: "REAUTH" } });
    }
  } catch (e) {
    console.error("mono webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
