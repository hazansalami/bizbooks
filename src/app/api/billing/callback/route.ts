import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPayment } from "@/lib/gateways";
import { activatePro } from "@/lib/billing";

// Paystack sends the owner back here after paying for Pro. Verify with Paystack, never the URL.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  const back = new URL("/app/settings/billing", request.url);
  const key = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  const pending = reference ? await db.platformPayment.findUnique({ where: { reference } }) : null;
  if (!key || !pending) {
    back.searchParams.set("error", "verify");
    return NextResponse.redirect(back);
  }
  const v = await verifyPayment("PAYSTACK", key, reference);
  if (v?.paid && v.currency === "NGN" && v.amount >= pending.amount) {
    await activatePro(pending.id);
    back.searchParams.set("upgraded", "1");
  } else {
    back.searchParams.set("error", "verify");
  }
  return NextResponse.redirect(back);
}
