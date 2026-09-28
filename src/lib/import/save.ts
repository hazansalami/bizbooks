import "server-only";
import { db } from "../db";
import { addDays, randomToken } from "../utils";
import type { ImpCustomer, ImpInvoice, ImpRecurring, ImportSource } from "./parse";
import { isPro } from "../plan";
import { FREE_RECURRING_LIMIT } from "../constants";
import { norm, numberPart, round2 } from "./values";

export type ImportOptions = {
  source: ImportSource;
  /** How to treat invoices the file says nothing about payment for. Invoices with payment data always follow the file. */
  paidMode: "paid" | "unpaid";
  createItems: boolean;
  continueNumbering: boolean;
  customers: ImpCustomer[];
  invoices: Omit<ImpInvoice, "issues" | "currency">[];
  /** Recurring invoices to set up: exported profiles and retainers spotted in the history that the owner kept ticked. */
  recurring: Omit<ImpRecurring, "key" | "count">[];
  /** Start them sending on their next date, or paused for a check first. */
  recurringActive: boolean;
};

export type ImportResult = {
  customersCreated: number; customersUpdated: number; invoicesCreated: number; paymentsCreated: number; itemsCreated: number;
  skipped: string[]; nextNumber: string | null;
  recurringCreated: number;
  /** Retainers left out because the Free plan's recurring limit was reached. */
  recurringOverLimit: string[];
};

const SOURCE_LABEL: Record<ImportSource, string> = { WAVE: "Wave", ZOHO: "Zoho Books", CSV: "CSV file" };

function scheduleTotal(s: { items: unknown; discount: number; vatRate: number }) {
  const lines = (s.items as { quantity: number; unitPrice: number }[]) ?? [];
  const taxable = round2(lines.reduce((t, l) => t + round2(l.quantity * l.unitPrice), 0) - s.discount);
  return round2(taxable + round2((taxable * s.vatRate) / 100));
}

/** VAT rate from the amounts, snapped to the standard 7.5% when that's what it is. */
function vatRateFor(taxable: number, vat: number) {
  if (!(taxable > 0) || !(vat > 0)) return 0;
  const r = round2((vat / taxable) * 100);
  return Math.abs(r - 7.5) < 0.05 ? 7.5 : r;
}

/**
 * All-or-nothing: one transaction, so a failure part-way leaves the books exactly as they were.
 * Existing clients are matched by name and only have blank fields filled in. Invoice numbers already
 * in BizBooks are skipped, so importing the same file twice is safe.
 */
export async function importData(businessId: string, o: ImportOptions): Promise<ImportResult> {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  const label = SOURCE_LABEL[o.source];

  return db.$transaction(async (tx) => {
    const res: ImportResult = {
      customersCreated: 0, customersUpdated: 0, invoicesCreated: 0, paymentsCreated: 0, itemsCreated: 0, skipped: [], nextNumber: null,
      recurringCreated: 0, recurringOverLimit: [],
    };

    // Clients
    const existing = await tx.customer.findMany({ where: { businessId } });
    const byName = new Map(existing.map((c) => [norm(c.name), c]));
    const wanted = new Map<string, ImpCustomer>();
    for (const c of o.customers) wanted.set(norm(c.name), c);
    for (const x of [...o.invoices, ...o.recurring]) if (!wanted.has(norm(x.customer))) wanted.set(norm(x.customer), { name: x.customer });
    for (const [key, c] of wanted) {
      const found = byName.get(key);
      const fields = { email: c.email?.toLowerCase() || null, phone: c.phone || null, address: c.address || null, contactName: c.contactName || null, tin: c.tin || null };
      if (!found) {
        byName.set(key, await tx.customer.create({ data: { businessId, name: c.name.trim(), ...fields, notes: `Imported from ${label}` } }));
        res.customersCreated++;
      } else {
        const fill = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v && !found[k as keyof typeof fields]));
        if (Object.keys(fill).length) {
          await tx.customer.update({ where: { id: found.id }, data: fill });
          res.customersUpdated++;
        }
      }
    }

    // Invoices
    const taken = new Set((await tx.invoice.findMany({ where: { businessId, kind: "INVOICE" }, select: { number: true } })).map((i) => i.number));
    let maxNumber = 0;
    for (const inv of o.invoices) {
      if (taken.has(inv.number)) { res.skipped.push(inv.number); continue; }
      taken.add(inv.number);
      const customer = byName.get(norm(inv.customer))!;
      const subtotal = round2(inv.lines.reduce((s, l) => s + l.amount, 0));
      const discount = round2(Math.min(Math.max(inv.discount, 0), Math.max(subtotal, 0)));
      const vatAmount = round2(Math.max(inv.vatAmount, 0));
      const total = round2(inv.total || subtotal - discount + vatAmount);
      const issueDate = new Date(`${inv.issueDate}T09:00:00`);
      const dueDate = inv.dueDate ? new Date(`${inv.dueDate}T09:00:00`) : addDays(issueDate, business.paymentTermsDays);

      const known = inv.paid != null || inv.status != null || inv.payments.length > 0;
      const paid = inv.status === "VOID" ? 0
        : known ? round2(Math.min(Math.max(inv.paid ?? (inv.status === "PAID" ? total : 0), 0), total))
        : o.paidMode === "paid" ? total : 0;
      const status = inv.status === "VOID" ? "VOID" : inv.status === "DRAFT" && paid === 0 ? "DRAFT"
        : paid >= total - 0.005 && total > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "SENT";

      // Payments: the file's own dated payments when we have them, otherwise one payment for what's been paid.
      const filePayments = inv.payments.filter((p) => p.amount > 0);
      const payments = filePayments.length
        ? filePayments.map((p) => ({ amount: round2(p.amount), paidAt: new Date(`${p.date}T12:00:00`) }))
        : paid > 0 ? [{ amount: paid, paidAt: dueDate < new Date() ? dueDate : issueDate }] : [];
      const lastPaid = payments.reduce<Date | null>((d, p) => (!d || p.paidAt > d ? p.paidAt : d), null);

      await tx.invoice.create({
        data: {
          businessId, customerId: customer.id, kind: "INVOICE", number: inv.number, status,
          issueDate, dueDate, subtotal, discount, vatRate: vatRateFor(subtotal - discount, vatAmount), vatAmount,
          whtRate: 0, whtAmount: 0, total, amountPaid: paid, notes: inv.notes || null, poNumber: inv.poNumber || null,
          publicToken: randomToken(), sentAt: status === "DRAFT" ? null : issueDate, paidAt: status === "PAID" ? lastPaid : null,
          importSource: o.source,
          items: { create: inv.lines.map((l, i) => ({ description: l.name, details: l.details || null, quantity: l.quantity, unitPrice: round2(l.unitPrice), amount: round2(l.amount), position: i })) },
          events: { create: { type: "IMPORTED", note: `From ${label}`, createdAt: issueDate } },
          payments: { create: payments.map((p) => ({ businessId, amount: p.amount, method: "OTHER", paidAt: p.paidAt, note: `Imported from ${label}` })) },
        },
      });
      res.invoicesCreated++;
      res.paymentsCreated += payments.length;
      const n = numberPart(inv.number);
      if (Number.isFinite(n) && n > maxNumber) maxNumber = n;
    }

    // Services, with their latest price and description, so they autocomplete on new invoices.
    if (o.createItems) {
      const known = new Set((await tx.item.findMany({ where: { businessId }, select: { name: true } })).map((i) => norm(i.name)));
      const latest = new Map<string, { name: string; details: string | null; unitPrice: number }>();
      for (const inv of [...o.invoices].sort((a, b) => a.issueDate.localeCompare(b.issueDate))) {
        for (const l of inv.lines) {
          if (l.unitPrice <= 0 || /^invoice\s/i.test(l.name) || known.has(norm(l.name))) continue;
          latest.set(norm(l.name), { name: l.name, details: l.details || latest.get(norm(l.name))?.details || null, unitPrice: l.unitPrice });
        }
      }
      if (latest.size) {
        await tx.item.createMany({ data: [...latest.values()].map((i) => ({ businessId, name: i.name.slice(0, 200), description: i.details, unitPrice: round2(i.unitPrice) })) });
        res.itemsCreated = latest.size;
      }
    }

    // Carry on the old numbering: after Wave's 0331, the next BizBooks invoice is INV-0332.
    if (o.continueNumbering && maxNumber >= business.nextInvoiceNo) {
      await tx.business.update({ where: { id: businessId }, data: { nextInvoiceNo: maxNumber + 1 } });
      res.nextNumber = `${business.invoicePrefix}-${String(maxNumber + 1).padStart(4, "0")}`;
    }

    // Recurring invoices. Re-importing is safe: a client that already has a live schedule for the same amount is skipped.
    if (o.recurring.length) {
      const live = await tx.recurringSchedule.findMany({ where: { businessId, status: { in: ["ACTIVE", "PAUSED"] } } });
      let room = isPro(business) ? Infinity : Math.max(0, FREE_RECURRING_LIMIT - live.length);
      for (const r of o.recurring) {
        const customer = byName.get(norm(r.customer))!;
        const subtotal = round2(r.lines.reduce((s, l) => s + l.amount, 0));
        const discount = round2(Math.min(Math.max(r.discount, 0), Math.max(subtotal, 0)));
        const vatRate = vatRateFor(subtotal - discount, r.vatAmount);
        const total = round2(subtotal - discount + round2(((subtotal - discount) * vatRate) / 100));
        if (live.some((s) => s.customerId === customer.id && Math.abs(scheduleTotal(s) - total) < 0.01)) continue;
        if (room <= 0) { res.recurringOverLimit.push(r.title); continue; }
        room--;
        await tx.recurringSchedule.create({
          data: {
            businessId, customerId: customer.id, title: r.title.slice(0, 120), frequency: r.frequency,
            nextRunAt: new Date(`${r.nextDate}T09:00:00`), endAt: r.endDate ? new Date(`${r.endDate}T23:59:00`) : null,
            status: o.recurringActive ? "ACTIVE" : "PAUSED", autoSend: true, dueInDays: business.paymentTermsDays,
            items: r.lines.map((l) => ({ description: l.name, details: l.details || null, quantity: l.quantity, unitPrice: round2(l.unitPrice) })),
            discount, vatRate, whtRate: 0, notes: null,
          },
        });
        res.recurringCreated++;
      }
    }
    return res;
  }, { timeout: 120_000, maxWait: 10_000 });
}
