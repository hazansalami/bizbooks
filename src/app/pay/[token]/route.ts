import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { loadFullInvoice } from "@/lib/invoices";
import { startInvoiceCheckout } from "@/lib/checkout";

/**
 * The link in emails and WhatsApp messages: one tap and the customer lands on the gateway's checkout.
 * If we can't go straight there (no customer email, nothing to pay), fall back to the invoice page.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await db.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
  if (!found) return NextResponse.redirect(new URL("/", request.url));
  const fallback = new URL(`/i/${token}#pay`, request.url);
  const inv = await loadFullInvoice(found.id);
  if (!inv?.customer.email) return NextResponse.redirect(fallback);
  const r = await startInvoiceCheckout(inv, inv.customer.email);
  if ("url" in r) return NextResponse.redirect(r.url, 303);
  return NextResponse.redirect(fallback);
}
