import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPro } from "@/lib/plan";
import { PERIODS, periodRange, type Period } from "@/lib/reports";
import { PAYMENT_METHODS } from "@/lib/constants";
import { dateInput as day } from "@/lib/utils";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** One CSV with every payment and expense in the period: what an accountant asks for first. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const business = user?.business;
  if (!business) return NextResponse.redirect(new URL("/login", request.url));
  if (!isPro(business)) return NextResponse.redirect(new URL("/app/settings/billing", request.url));
  const p = request.nextUrl.searchParams.get("period");
  const period: Period = p && p in PERIODS ? (p as Period) : "this-month";
  const { from, to } = periodRange(period);
  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { businessId: business.id, paidAt: { gte: from, lt: to } }, include: { invoice: { include: { customer: true } } }, orderBy: { paidAt: "asc" } }),
    db.expense.findMany({ where: { businessId: business.id, date: { gte: from, lt: to } }, orderBy: { date: "asc" } }),
  ]);
  const rows: unknown[][] = [["Date", "Type", "Description", "Customer / supplier", "Reference", "Method", "Money in", "Money out", "VAT"]];
  for (const pay of payments) {
    const inv = pay.invoice;
    const vat = inv && inv.total - inv.whtAmount > 0 ? (inv.vatAmount * pay.amount) / (inv.total - inv.whtAmount) : 0;
    rows.push([day(pay.paidAt), "Income", inv ? `Payment for ${inv.number}` : "Payment", inv?.customer.name, pay.reference ?? inv?.number, PAYMENT_METHODS[pay.method] ?? pay.method, pay.amount.toFixed(2), "", vat.toFixed(2)]);
  }
  for (const e of expenses) {
    rows.push([day(e.date), "Expense", [e.category, e.note].filter(Boolean).join(": "), e.vendor, "", PAYMENT_METHODS[e.method] ?? e.method, "", e.amount.toFixed(2), e.vatAmount.toFixed(2)]);
  }
  rows.sort((a, b) => (a[0] === "Date" ? -1 : b[0] === "Date" ? 1 : String(a[0]).localeCompare(String(b[0]))));
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${business.name.replace(/[^\w]+/g, "-")}-${period}-${day(from)}.csv"`,
    },
  });
}
