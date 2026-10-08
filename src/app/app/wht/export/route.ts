import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { whtDeductions } from "@/lib/wht";
import { dateInput as day } from "@/lib/utils";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Every WHT deduction with its credit status, plus credits not tied to an invoice: for the accountant filing CIT. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const business = user?.business;
  if (!business) return NextResponse.redirect(new URL("/login", request.url));
  if (!business.whtTracking) return NextResponse.redirect(new URL("/app/wht", request.url));
  const thisYear = new Date().getFullYear();
  const y = request.nextUrl.searchParams.get("year");
  const year = y && /^\d{4}$/.test(y) && +y <= thisYear && +y >= thisYear - 5 ? +y : null;
  const since = year ? new Date(year, 0, 1) : new Date(thisYear - 2, 0, 1);
  const until = year ? new Date(year + 1, 0, 1) : new Date(thisYear + 1, 0, 1);

  const deductions = (await whtDeductions(business.id, since)).filter((d) => d.paidAt < until);
  const credits = await db.whtCredit.findMany({ where: { businessId: business.id, date: { gte: since, lt: until } }, include: { invoice: { select: { number: true } } }, orderBy: { date: "asc" } });
  const byInvoice = new Map(credits.filter((c) => c.invoiceId).map((c) => [c.invoiceId!, c]));

  const rows: unknown[][] = [["Invoice", "Client", "Client TIN", "Paid on", "WHT deducted (NGN)", "Status", "Credit date", "Credit reference", "Credit amount (NGN)"]];
  for (const d of deductions.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())) {
    const c = byInvoice.get(d.invoiceId);
    rows.push([d.number, d.customerName, d.customerTin, day(d.paidAt), d.amount.toFixed(2), d.status.toLowerCase(), c ? day(c.date) : "", c?.reference, c ? c.amount.toFixed(2) : ""]);
  }
  for (const c of credits.filter((c) => !c.invoiceId)) {
    rows.push(["", c.payerName, c.payerTin, "", "", "credit (no invoice)", day(c.date), c.reference, c.amount.toFixed(2)]);
  }
  rows.push([]);
  rows.push(["", "Total credits on file", "", "", "", "", "", "", credits.reduce((t, c) => t + c.amount, 0).toFixed(2)]);
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${business.name.replace(/[^\w]+/g, "-")}-WHT-${year ?? "last-3-years"}.csv"`,
    },
  });
}
