import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/lib/nurture";

// RFC 8058 one-click unsubscribe: mail clients POST here from the List-Unsubscribe header.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  await unsubscribeByToken(token);
  return NextResponse.json({ ok: true });
}
