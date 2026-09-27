import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { invoiceIdFromReference, paystackSignatureValid } from "@/lib/gateways";
import { settleReference } from "@/lib/checkout";

/**
 * Each business pastes this URL into its own Paystack dashboard. The signature is checked with that
 * business's secret key, and the payment is then re-verified with Paystack before it's recorded.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const raw = await request.text();
  const gateway = await db.gateway.findUnique({ where: { businessId_provider: { businessId, provider: "PAYSTACK" } } });
  if (!gateway) return NextResponse.json({ ok: false }, { status: 404 });
  if (!paystackSignatureValid(raw, request.headers.get("x-paystack-signature"), decryptSecret(gateway.secretKeyEnc))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const reference = event.data?.reference ?? "";
  const invoiceId = invoiceIdFromReference(reference);
  if (event.event === "charge.success" && invoiceId) {
    const inv = await db.invoice.findFirst({ where: { id: invoiceId, businessId }, select: { id: true } });
    if (inv) await settleReference(inv.id, "PAYSTACK", reference);
  }
  // Always 200 for events we don't handle, so Paystack stops retrying them.
  return NextResponse.json({ ok: true });
}
