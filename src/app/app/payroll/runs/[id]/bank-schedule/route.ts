import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/payroll";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/**
 * Bulk-transfer schedule for the business's own bank. Column names follow the common layout Nigerian
 * banks accept (beneficiary name, account number, bank, amount, narration); some banks want their own
 * template, so the columns are simple to copy across.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.business) return NextResponse.redirect(new URL("/login", request.url));
  const { id } = await params;
  const run = await db.payRun.findFirst({ where: { id, businessId: user.business.id }, include: { items: { orderBy: { fullName: "asc" } } } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const narration = `${user.business.name.slice(0, 20)} ${periodLabel(run.period)} pay`;
  const rows: unknown[][] = [["Beneficiary name", "Account number", "Bank", "Amount", "Narration"]];
  for (const i of run.items) {
    if (!i.accountNumber) continue;
    rows.push([i.accountName || i.fullName, i.accountNumber, i.bankName, i.net.toFixed(2), narration]);
  }
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="salary-schedule-${run.period}.csv"`,
    },
  });
}
