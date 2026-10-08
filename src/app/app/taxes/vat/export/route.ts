import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isPeriod, lastMonth, vatReturn } from "@/lib/vat-return";
import { dateInput as day } from "@/lib/utils";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** The VAT schedules as CSV: sales (output VAT) or purchases (input VAT), naira. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const business = user?.business;
  if (!business) return NextResponse.redirect(new URL("/login", request.url));
  const m = request.nextUrl.searchParams.get("month") ?? undefined;
  const period = isPeriod(m) ? m : lastMonth();
  const purchases = request.nextUrl.searchParams.get("type") === "purchases";
  const r = await vatReturn(business.id, period);
  const rows: unknown[][] = purchases
    ? [["Date", "Supplier", "Category", "Amount before VAT (NGN)", "VAT (NGN)", "Total (NGN)"], ...r.purchases.map((p) => [day(p.date), p.vendor, p.category, p.net.toFixed(2), p.vat.toFixed(2), p.gross.toFixed(2)])]
    : [
        ["Date", "Invoice number", "Customer", "Customer TIN", "Amount before VAT (NGN)", "VAT rate (%)", "VAT (NGN)", "Invoice currency"],
        ...r.sales.map((s) => [day(s.date), s.number, s.customer, s.tin, s.net.toFixed(2), s.rate, s.vat.toFixed(2), s.currency]),
        ...r.exempt.map((s) => [day(s.date), s.number, s.customer, s.tin, s.net.toFixed(2), 0, "0.00", "exempt / zero-rated"]),
      ];
  const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${business.name.replace(/[^\w]+/g, "-")}-VAT-${purchases ? "purchases" : "sales"}-${period}.csv"`,
    },
  });
}
