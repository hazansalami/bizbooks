import { NextResponse, type NextRequest } from "next/server";
import { referrerByCode } from "@/lib/growth";

/** Referral links: /r/KOLA7Q2 (shared) and /r/KOLA7Q2?src=invoice (the line on an invoice). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referrer = await referrerByCode(code);
  const dest = new URL("/signup", request.url);
  if (!referrer) return NextResponse.redirect(dest);
  const source = request.nextUrl.searchParams.get("src") === "invoice" ? "INVOICE" : "LINK";
  dest.searchParams.set("ref", code.toUpperCase());
  const res = NextResponse.redirect(dest);
  res.cookies.set("bb_ref", `${code.toUpperCase()}|${source}`, { maxAge: 60 * 60 * 24 * 60, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return res;
}
