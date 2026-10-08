import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Opens one stored company document. Only the business that uploaded it can see it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const business = user?.business;
  if (!business) return NextResponse.redirect(new URL("/login", request.url));
  const { id } = await params;
  const doc = await db.companyDocument.findFirst({ where: { id, businessId: business.id } });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const name = doc.fileName.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(Buffer.from(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${request.nextUrl.searchParams.has("download") ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
