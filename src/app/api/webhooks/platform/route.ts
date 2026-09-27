import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { paystackSignatureValid, verifyPayment } from "@/lib/gateways";
import { activatePro } from "@/lib/billing";

// BizBooks' own Paystack webhook, for Pro payments where the owner closed the tab before the redirect.
export async function POST(request: NextRequest) {
  const key = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await request.text();
  if (!paystackSignatureValid(raw, request.headers.get("x-paystack-signature"), key)) return NextResponse.json({ ok: false }, { status: 401 });
  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } };
  const reference = event.data?.reference ?? "";
  if (event.event === "charge.success" && reference.startsWith("bbsub-")) {
    const pending = await db.platformPayment.findUnique({ where: { reference } });
    const v = pending ? await verifyPayment("PAYSTACK", key, reference) : null;
    if (pending && v?.paid && v.amount >= pending.amount) await activatePro(pending.id);
  }
  return NextResponse.json({ ok: true });
}
