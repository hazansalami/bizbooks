import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invoiceIdFromReference, type Provider } from "@/lib/gateways";
import { settlePlatformReference, settleReference } from "@/lib/checkout";

// Where Paystack (?reference=) and Flutterwave (?tx_ref=) send the customer after checkout.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const provider: Provider = q.get("provider") === "FLUTTERWAVE" ? "FLUTTERWAVE" : "PAYSTACK";
  const token = q.get("t") ?? "";
  const reference = q.get("reference") || q.get("trxref") || q.get("tx_ref") || "";
  const inv = await db.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
  if (!inv) return NextResponse.redirect(new URL("/", request.url));
  const back = new URL(`/i/${token}`, request.url);
  if (provider === "FLUTTERWAVE" && q.get("status") === "cancelled") {
    back.searchParams.set("payment", "cancelled");
    return NextResponse.redirect(back);
  }
  if (!reference || invoiceIdFromReference(reference) !== inv.id) {
    back.searchParams.set("payment", "failed");
    return NextResponse.redirect(back);
  }
  const r = q.get("mode") === "platform" ? await settlePlatformReference(inv.id, reference) : await settleReference(inv.id, provider, reference);
  back.searchParams.set("payment", r.ok ? "success" : "pending");
  return NextResponse.redirect(back);
}
