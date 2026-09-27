import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { flutterwaveHashValid, invoiceIdFromReference } from "@/lib/gateways";
import { settleReference } from "@/lib/checkout";

// Flutterwave sends the "secret hash" the business set on its dashboard in the verif-hash header.
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const gateway = await db.gateway.findUnique({ where: { businessId_provider: { businessId, provider: "FLUTTERWAVE" } } });
  if (!gateway?.webhookHashEnc) return NextResponse.json({ ok: false }, { status: 404 });
  if (!flutterwaveHashValid(request.headers.get("verif-hash"), decryptSecret(gateway.webhookHashEnc))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { event?: string; data?: { tx_ref?: string; status?: string } } | null;
  const reference = body?.data?.tx_ref ?? "";
  const invoiceId = invoiceIdFromReference(reference);
  if (body?.event === "charge.completed" && invoiceId) {
    const inv = await db.invoice.findFirst({ where: { id: invoiceId, businessId }, select: { id: true } });
    if (inv) await settleReference(inv.id, "FLUTTERWAVE", reference);
  }
  return NextResponse.json({ ok: true });
}
