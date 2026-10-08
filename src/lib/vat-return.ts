import "server-only";
import { db } from "./db";
import { round2 } from "./money";
import { vatSummary } from "./reports";
import { periodLabel } from "./payroll";
import { TAX_DEADLINES } from "./constants";

/*
  The monthly VAT return, worked out from what's recorded: output VAT on invoices issued in the month,
  input VAT on purchases with a VAT receipt, and the sales with no VAT (exempt or zero-rated) the return
  form also asks for. Laid out to copy straight into the VAT return on TaxPro-Max, with the schedules
  behind every figure.
*/

export const isPeriod = (p: string | undefined): p is string => !!p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

export function lastMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function vatReturn(businessId: string, period: string) {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  const [vat, noVat, filing] = await Promise.all([
    vatSummary(businessId, from, to),
    db.invoice.findMany({
      where: { businessId, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: from, lt: to }, vatAmount: 0 },
      include: { customer: { select: { name: true, tin: true } } }, orderBy: { issueDate: "asc" },
    }),
    db.taxFiling.findUnique({ where: { businessId_kind_period: { businessId, kind: "VAT", period } } }),
  ]);
  const sales = vat.invoices.map((i) => ({
    id: i.id, date: i.issueDate, number: i.number, customer: i.customer.name, tin: i.customer.tin, currency: i.currency,
    net: i.netNgn, vat: i.vatNgn, rate: i.vatRate,
  }));
  const exempt = noVat.map((i) => ({ id: i.id, date: i.issueDate, number: i.number, customer: i.customer.name, tin: i.customer.tin, net: round2((i.subtotal - i.discount) * i.exchangeRate) }));
  const purchases = vat.expenses.map((e) => ({ id: e.id, date: e.date, vendor: e.vendor ?? "Not recorded", category: e.category, gross: e.amount, vat: e.vatAmount, net: round2(e.amount - e.vatAmount) }));
  const salesNet = round2(sales.reduce((s, x) => s + x.net, 0));
  const exemptNet = round2(exempt.reduce((s, x) => s + x.net, 0));
  const purchasesNet = round2(purchases.reduce((s, x) => s + x.net, 0));
  return {
    period, label: periodLabel(period), from, to,
    dueDate: new Date(y, m, TAX_DEADLINES.vatDay),
    sales, exempt, purchases,
    totals: {
      totalSupplies: round2(salesNet + exemptNet), vatableSupplies: salesNet, exemptSupplies: exemptNet,
      output: vat.output, purchasesNet, input: vat.input, net: vat.net,
    },
    filing,
    missingTins: sales.filter((s) => !s.tin).length,
    missingVendors: purchases.filter((p) => p.vendor === "Not recorded").length,
  };
}

export type VatReturn = Awaited<ReturnType<typeof vatReturn>>;
