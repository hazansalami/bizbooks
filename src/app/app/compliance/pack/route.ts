import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildVendorPack } from "@/lib/vendor-pack";

/** The vendor pack: a cover sheet plus every current document, as one PDF. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const business = user?.business;
  if (!business) return NextResponse.redirect(new URL("/login", request.url));
  if (!business.complianceTracking) return NextResponse.redirect(new URL("/app/compliance", request.url));
  const pack = await buildVendorPack(business.id);
  return new NextResponse(Buffer.from(pack.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pack.name.replace(/[^\w]+/g, "-")}-company-documents.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
