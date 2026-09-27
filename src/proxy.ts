import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Optimistic check only: pages still load the user and business from the database.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("bb_session")?.value;
  let valid = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
      valid = true;
    } catch {}
  }
  if (!valid) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
