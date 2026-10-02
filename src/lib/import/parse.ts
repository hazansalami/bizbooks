import { column, dateOrderOf, norm, numberPart, parseCSV, parseDate, parseMoney, round2, type DateOrder } from "./values";

/*
  Reads exports from Wave and Zoho Books (and most other invoice CSVs) into one shape the importer understands.

  Supported, detected automatically:
  - Wave "Account Transactions" report (Reports → Account Transactions → Export CSV)
  - Wave accounting data export (Settings → Data Export → Accounting transactions CSV)
  - Zoho Books invoice export (Sales → Invoices → Export), one row per line item
  - Customer / contact lists from Wave, Zoho Books or a spreadsheet
  - Any invoice CSV with invoice number, client, date and amount columns
*/

export type ImportSource = "WAVE" | "ZOHO" | "CSV";

export type ImpCustomer = { name: string; email?: string | null; phone?: string | null; address?: string | null; contactName?: string | null; tin?: string | null };
export type ImpLine = { name: string; details?: string | null; quantity: number; unitPrice: number; amount: number };
export type ImpPayment = { date: string; amount: number };
export type ImpInvoice = {
  number: string; customer: string; issueDate: string; dueDate: string | null; lines: ImpLine[];
  discount: number; vatAmount: number; total: number;
  /** null when the file says nothing about payments. */
  paid: number | null;
  status: "PAID" | "PARTIAL" | "UNPAID" | "DRAFT" | "VOID" | null;
  payments: ImpPayment[];
  poNumber?: string | null; notes?: string | null; currency?: string | null;
  /** Problems worth showing next to this invoice in the preview. */
  issues: string[];
};

export type ParsedFile = {
  fileName: string;
  source: ImportSource;
  label: string;
  customers: ImpCustomer[];
  invoices: ImpInvoice[];
  warnings: string[];
  /** True when the file can tell paid from unpaid. */
  hasPayments: boolean;
  hasDueDates: boolean;
  hasLineDetails: boolean;
  /** Recurring profiles exported from the old tool (Zoho Books recurring invoices). */
  recurring?: ImpRecurring[];
  from?: string | null; to?: string | null;
  /** Every date in the file reads both ways (03/04/2026), so day-first was assumed: ask the owner to confirm. */
  dateOrderGuessed?: boolean;
  /** A date from the file, to show how it was read when asking. */
  sampleDate?: string;
};

/* The date order for the file being parsed: the owner's choice when they've made one, otherwise detected. */
let dateCtx: { forced?: DateOrder; guessed: boolean; sample?: string } = { guessed: false };
function pickOrder(values: string[]): DateOrder {
  if (!dateCtx.sample) dateCtx.sample = values.find((v) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(v.trim()));
  if (dateCtx.forced) return dateCtx.forced;
  const { order, guessed } = dateOrderOf(values);
  if (guessed) dateCtx.guessed = true;
  return order;
}

/** Parse one exported file. Pass dateOrder once the owner has said how the file writes its dates. */
export function parseImportFile(fileName: string, text: string, dateOrder?: DateOrder): ParsedFile {
  dateCtx = { forced: dateOrder, guessed: false };
  const parsed = parseImportFileWith(fileName, text);
  return dateCtx.guessed || dateOrder ? { ...parsed, dateOrderGuessed: dateCtx.guessed || !!dateOrder, sampleDate: dateCtx.sample } : parsed;
}

function parseImportFileWith(fileName: string, text: string): ParsedFile {
  const rows = parseCSV(text).filter((r) => r.some((c) => c !== ""));
  const base = { fileName, customers: [], invoices: [], warnings: [], hasPayments: false, hasDueDates: false, hasLineDetails: false };
  if (!rows.length) return { ...base, source: "CSV", label: "Empty file", warnings: ["This file is empty."] };

  const head = rows.slice(0, 8).map((r) => norm(r.join(" ")));
  const reportHeader = rows.findIndex((r) => norm(r.join(" ")).startsWith("account number date description debit"));
  if (reportHeader >= 0 || head[0] === "account transactions") return waveReport(fileName, rows, Math.max(reportHeader, 0));

  const headerRow = rows.findIndex((r) => r.filter(Boolean).length >= 2);
  const headers = rows[headerRow];
  const data = rows.slice(headerRow + 1);
  const has = (...n: string[]) => column(headers, ...n) >= 0;

  if (has("transaction id") && has("account name")) return waveAccounting(fileName, headers, data);
  if (has("recurrence name", "profile name", "recurring invoice name") || (has("repeat every", "recurrence frequency", "frequency") && !has("invoice number"))) {
    return recurringRows(fileName, headers, data);
  }
  if (has("invoice number", "invoice no", "invoice #", "invoice")) return invoiceRows(fileName, headers, data);
  if (has("display name", "customer name", "company name", "name", "customer", "client")) return customerRows(fileName, headers, data);

  return { ...base, source: "CSV", label: "Unrecognised file", warnings: ["We couldn't find invoice or client columns in this file. Export invoices or customers as CSV and try again."] };
}

/* ---------- Shared: ledger entries → invoices (Wave report and Wave accounting export) ---------- */

type Entry = { account: string; date: string; description: string; debit: number; credit: number; customer?: string; number?: string; line?: string };
type Role = "receivable" | "tax" | "income" | "other";

function roleOf(account: string, group = ""): Role {
  const a = norm(`${account} ${group}`);
  if (/receivable/.test(a)) return "receivable";
  if (/\b(vat|sales tax|tax payable|output tax)\b/.test(a)) return "tax";
  if (/\b(sales|income|revenue|fees|services|consulting)\b/.test(a)) return "income";
  return "other";
}

/** "Arthur Group - 0309 - Graphic Design" → customer, number, item. Customer names can contain " - ". */
export function splitDescription(desc: string) {
  const cleaned = desc.replace(/^(invoice\s+payment|payment(\s+for)?|credit note|refund)\s*[:-]?\s*/i, "");
  const parts = cleaned.split(" - ");
  for (let i = 1; i < parts.length; i++) {
    if (/^[A-Za-z]{0,6}[-/#]?\d[\w/-]*$/.test(parts[i].trim())) {
      return { customer: parts.slice(0, i).join(" - ").trim(), number: parts[i].trim(), item: parts.slice(i + 1).join(" - ").trim() };
    }
  }
  return null;
}

function ledgerToInvoices(entries: Entry[], termsHint: boolean) {
  const invoices = new Map<string, ImpInvoice>();
  const issues: string[] = [];
  const get = (number: string, customer: string, date: string) => {
    let inv = invoices.get(number);
    if (!inv) {
      inv = { number, customer, issueDate: date, dueDate: null, lines: [], discount: 0, vatAmount: 0, total: 0, paid: null, status: null, payments: [], issues: [] };
      invoices.set(number, inv);
    }
    return inv;
  };
  let payments = 0;
  const orphanPayments: Entry[] = [];

  // Receivable debits first so each invoice gets its date and total before its lines arrive.
  const byRole = (r: Role) => entries.filter((e) => roleOf(e.account) === r);
  for (const e of byRole("receivable")) {
    const parsed = e.number ? { customer: e.customer ?? "", number: e.number } : splitDescription(e.description);
    if (e.debit > 0 && parsed?.number) {
      const inv = get(parsed.number, parsed.customer, e.date);
      inv.total = round2(inv.total + e.debit);
      if (e.date < inv.issueDate) inv.issueDate = e.date;
    } else if (e.credit > 0) {
      const inv = parsed?.number ? invoices.get(parsed.number) : undefined;
      if (inv) { inv.payments.push({ date: e.date, amount: e.credit }); payments++; } else orphanPayments.push(e);
    }
  }
  for (const e of byRole("income")) {
    const parsed = e.number ? { customer: e.customer ?? "", number: e.number, item: e.line || e.description } : splitDescription(e.description);
    if (!parsed?.number) continue;
    const inv = get(parsed.number, parsed.customer, e.date);
    const amount = round2(e.credit - e.debit);
    if (!amount) continue;
    const name = (parsed.item || e.line || "Services").trim();
    inv.lines.push({ name, quantity: 1, unitPrice: amount, amount });
  }
  for (const e of byRole("tax")) {
    const parsed = e.number ? { customer: e.customer ?? "", number: e.number } : splitDescription(e.description);
    const inv = parsed?.number ? invoices.get(parsed.number) : undefined;
    if (inv) inv.vatAmount = round2(inv.vatAmount + e.credit - e.debit);
  }

  for (const inv of invoices.values()) {
    const lineSum = round2(inv.lines.reduce((s, l) => s + l.amount, 0));
    if (!inv.total) inv.total = round2(lineSum + inv.vatAmount);
    if (!inv.lines.length) inv.lines.push({ name: `Invoice ${inv.number}`, quantity: 1, unitPrice: round2(inv.total - inv.vatAmount), amount: round2(inv.total - inv.vatAmount) });
    const diff = round2(inv.total - (round2(inv.lines.reduce((s, l) => s + l.amount, 0)) + inv.vatAmount));
    if (Math.abs(diff) >= 0.01) inv.issues.push(`Lines and VAT add up to ${round2(inv.total - diff).toLocaleString("en-NG")} but the invoice total is ${inv.total.toLocaleString("en-NG")}. We'll keep the invoice total.`);
    if (payments > 0 || orphanPayments.length) {
      inv.paid = round2(inv.payments.reduce((s, p) => s + p.amount, 0));
    }
  }
  if (orphanPayments.length) issues.push(`${orphanPayments.length} payment${orphanPayments.length === 1 ? "" : "s"} couldn't be matched to an invoice number and will be skipped.`);
  void termsHint;
  return { invoices: [...invoices.values()].sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number)), issues, hasPayments: payments > 0 };
}

function customersFrom(invoices: ImpInvoice[]): ImpCustomer[] {
  return [...new Set(invoices.map((i) => i.customer).filter(Boolean))].map((name) => ({ name }));
}

/* ---------- Wave: Account Transactions report ---------- */

function waveReport(fileName: string, rows: string[][], headerIdx: number): ParsedFile {
  const warnings: string[] = [];
  const meta = rows.slice(0, headerIdx).map((r) => r.join(" "));
  const range = meta.map((l) => /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/.exec(l)).find(Boolean);
  const basis = meta.find((l) => /report type/i.test(l));

  const entries: Entry[] = [];
  let account = "";
  let openingReceivable = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const [c0 = "", c1 = "", c2 = "", c3 = "", c4 = "", c5 = ""] = r;
    if (!c0 && c1 && !c2 && !c3 && !c4 && !/^\d{4}-\d{2}-\d{2}$/.test(c1)) { account = c1; continue; }
    if (/^starting balance/i.test(c0)) {
      if (roleOf(account) === "receivable") openingReceivable = parseMoney(c5) || 0;
      continue;
    }
    if (/^(totals|balance change)/i.test(c0)) continue;
    const date = parseDate(c1);
    if (!date) continue;
    entries.push({ account, date, description: c2, debit: parseMoney(c3) || 0, credit: parseMoney(c4) || 0 });
  }

  const accounts = new Set(entries.map((e) => roleOf(e.account)));
  const { invoices, issues, hasPayments } = ledgerToInvoices(entries, true);
  warnings.push(...issues);
  if (!accounts.has("receivable")) warnings.push("This report doesn't include Accounts Receivable, so invoice totals are rebuilt from sales lines. Include Accounts Receivable when you export.");
  if (!accounts.has("income")) warnings.push("This report doesn't include your sales accounts, so each invoice comes in as one line. Include your income accounts to bring in services.");
  if (openingReceivable > 0.005 && range) {
    warnings.push(`Clients already owed ₦${openingReceivable.toLocaleString("en-NG", { maximumFractionDigits: 2 })} before ${new Date(`${range[1]}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Those older invoices aren't in this file. Export again starting from your first invoice to bring them in.`);
  }
  if (basis && !/accrual/i.test(basis)) warnings.push("This report is on a cash basis, so unpaid invoices may be missing. Re-run it as Accrual (Paid & Unpaid).");

  return {
    fileName, source: "WAVE", label: "Wave · Account Transactions report",
    customers: customersFrom(invoices), invoices, warnings,
    hasPayments, hasDueDates: false, hasLineDetails: false,
    from: range?.[1] ?? null, to: range?.[2] ?? null,
  };
}

/* ---------- Wave: Settings → Data Export → Accounting transactions ---------- */

function waveAccounting(fileName: string, headers: string[], data: string[][]): ParsedFile {
  const c = {
    date: column(headers, "transaction date", "date"),
    account: column(headers, "account name"),
    group: column(headers, "account group", "account type"),
    desc: column(headers, "transaction description", "description"),
    line: column(headers, "transaction line description", "line description"),
    one: column(headers, "amount (one column)", "amount"),
    debit: column(headers, "debit amount", "debit"),
    credit: column(headers, "credit amount", "credit"),
    customer: column(headers, "customer"),
    number: column(headers, "invoice number"),
  };
  const order = pickOrder(data.map((r) => r[c.date] ?? ""));
  const entries: Entry[] = [];
  for (const r of data) {
    const date = parseDate(r[c.date], order);
    if (!date) continue;
    let debit = c.debit >= 0 ? parseMoney(r[c.debit]) || 0 : 0;
    let credit = c.credit >= 0 ? parseMoney(r[c.credit]) || 0 : 0;
    if (!debit && !credit && c.one >= 0) {
      const v = parseMoney(r[c.one]) || 0;
      if (v > 0) debit = v; else credit = -v;
    }
    const group = c.group >= 0 ? r[c.group] : "";
    entries.push({
      account: `${r[c.account] ?? ""}${roleOf(r[c.account] ?? "") === "other" && /income/i.test(group) ? " income" : ""}`,
      date, description: r[c.desc] ?? "", debit, credit,
      customer: c.customer >= 0 ? r[c.customer] || undefined : undefined,
      number: c.number >= 0 ? r[c.number] || undefined : undefined,
      line: c.line >= 0 ? r[c.line] || undefined : undefined,
    });
  }
  const { invoices, issues, hasPayments } = ledgerToInvoices(entries, true);
  const dates = entries.map((e) => e.date).sort();
  return {
    fileName, source: "WAVE", label: "Wave · Accounting transactions export",
    customers: customersFrom(invoices), invoices, warnings: issues,
    hasPayments, hasDueDates: false, hasLineDetails: false, from: dates[0] ?? null, to: dates.at(-1) ?? null,
  };
}

/* ---------- Zoho Books invoice export, or any one-row-per-line invoice CSV ---------- */

function invoiceRows(fileName: string, headers: string[], data: string[][]): ParsedFile {
  const col = (...n: string[]) => column(headers, ...n);
  const c = {
    number: col("invoice number", "invoice no", "invoice #", "invoice"),
    customer: col("customer name", "customer", "client name", "client", "display name", "company name", "bill to"),
    date: col("invoice date", "issue date", "date"),
    due: col("due date", "payment due"),
    status: col("invoice status", "status"),
    item: col("item name", "product name", "service", "product", "item"),
    desc: col("item desc", "item description", "line description", "description"),
    qty: col("quantity", "qty", "hours"),
    rate: col("item price", "unit price", "rate", "price"),
    itemTotal: col("item total", "line total", "line amount"),
    itemTax: col("item tax amount", "tax amount", "vat amount"),
    total: col("total", "invoice total", "total amount", "amount"),
    balance: col("balance", "balance due", "amount due"),
    discount: col("entity discount amount", "discount amount"),
    po: col("purchaseorder", "purchase order", "po number", "reference#", "reference number", "order number"),
    notes: col("notes", "customer notes"),
    currency: col("currency code", "currency"),
    email: col("email", "customer email", "emailid"),
  };
  const isZoho = column(headers, "invoice id") >= 0 || column(headers, "item desc") >= 0 || column(headers, "invoice status") >= 0;
  const order = pickOrder(data.flatMap((r) => [r[c.date] ?? "", r[c.due] ?? ""]));
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const invoices = new Map<string, ImpInvoice & { itemTax: number; emails: Set<string> }>();
  const warnings: string[] = [];
  let noDate = 0;

  for (const r of data) {
    const number = get(r, c.number);
    if (!number) continue;
    let inv = invoices.get(number);
    if (!inv) {
      const issueDate = parseDate(get(r, c.date), order);
      if (!issueDate) { noDate++; continue; }
      const total = parseMoney(get(r, c.total));
      const balance = parseMoney(get(r, c.balance));
      const statusRaw = norm(get(r, c.status));
      const status: ImpInvoice["status"] =
        /void|cancel/.test(statusRaw) ? "VOID" : /draft/.test(statusRaw) ? "DRAFT" : /partial/.test(statusRaw) ? "PARTIAL"
          : /paid|closed/.test(statusRaw) ? "PAID" : statusRaw ? "UNPAID" : null;
      inv = {
        number, customer: get(r, c.customer), issueDate, dueDate: parseDate(get(r, c.due), order),
        lines: [], discount: Math.abs(parseMoney(get(r, c.discount)) || 0), vatAmount: 0,
        total: Number.isFinite(total) ? total : 0,
        paid: Number.isFinite(total) && Number.isFinite(balance) ? round2(total - balance) : status === "PAID" ? (Number.isFinite(total) ? total : null) : status === "UNPAID" || status === "DRAFT" ? 0 : null,
        status, payments: [], poNumber: get(r, c.po) || null, notes: get(r, c.notes) || null, currency: get(r, c.currency) || null,
        issues: [], itemTax: 0, emails: new Set(),
      };
      invoices.set(number, inv);
    }
    const email = get(r, c.email);
    if (email) inv.emails.add(email.toLowerCase());
    const itemName = get(r, c.item);
    const desc = get(r, c.desc);
    if (!itemName && !desc) continue;
    const qty = parseMoney(get(r, c.qty));
    const rate = parseMoney(get(r, c.rate));
    const lineTotal = parseMoney(get(r, c.itemTotal));
    const quantity = Number.isFinite(qty) && qty !== 0 ? qty : 1;
    const amount = round2(Number.isFinite(lineTotal) ? lineTotal : quantity * (Number.isFinite(rate) ? rate : 0));
    const unitPrice = Number.isFinite(rate) && Math.abs(round2(rate * quantity) - amount) < 0.01 ? rate : round2(amount / quantity);
    const name = itemName || desc.split("\n")[0].slice(0, 120);
    const details = itemName ? desc || null : desc.includes("\n") ? desc.split("\n").slice(1).join("\n").trim() || null : null;
    inv.lines.push({ name, details, quantity, unitPrice, amount });
    inv.itemTax = round2(inv.itemTax + (parseMoney(get(r, c.itemTax)) || 0));
  }

  const customers = new Map<string, ImpCustomer>();
  const out: ImpInvoice[] = [];
  for (const { itemTax, emails, ...inv } of invoices.values()) {
    const lineSum = round2(inv.lines.reduce((s, l) => s + l.amount, 0));
    if (!inv.total) inv.total = round2(lineSum - inv.discount + itemTax);
    inv.vatAmount = itemTax || Math.max(0, round2(inv.total - (lineSum - inv.discount)));
    if (!inv.lines.length) inv.lines.push({ name: `Invoice ${inv.number}`, quantity: 1, unitPrice: round2(inv.total - inv.vatAmount), amount: round2(inv.total - inv.vatAmount) });
    const diff = round2(inv.total - (lineSum - inv.discount + inv.vatAmount));
    if (inv.lines.length && Math.abs(diff) >= 0.01 && lineSum) inv.issues.push(`Lines, discount and tax differ from the invoice total by ${Math.abs(diff).toLocaleString("en-NG")}. We'll keep the invoice total.`);
    if (!customers.has(inv.customer.toLowerCase())) customers.set(inv.customer.toLowerCase(), { name: inv.customer, email: [...emails][0] ?? null });
    out.push(inv);
  }
  if (noDate) warnings.push(`${noDate} row${noDate === 1 ? "" : "s"} had no readable invoice date (or an impossible one, like 31 February) and ${noDate === 1 ? "was" : "were"} skipped.`);
  if (c.customer < 0) warnings.push("We couldn't find a client column. Every invoice needs a client name.");
  const foreign = out.filter((i) => i.currency && !/^(ngn|₦|naira)$/i.test(i.currency)).length;
  if (foreign) warnings.push(`${foreign} invoice${foreign === 1 ? " is" : "s are"} in another currency. Amounts come in as they are, recorded in naira.`);
  const dates = out.map((i) => i.issueDate).sort();

  return {
    fileName, source: isZoho ? "ZOHO" : "CSV", label: isZoho ? "Zoho Books · Invoices export" : "Invoice list",
    customers: [...customers.values()].filter((x) => x.name), invoices: out.sort((a, b) => a.issueDate.localeCompare(b.issueDate)), warnings,
    hasPayments: c.balance >= 0 || c.status >= 0, hasDueDates: c.due >= 0, hasLineDetails: c.desc >= 0 || c.item >= 0,
    from: dates[0] ?? null, to: dates.at(-1) ?? null,
  };
}

/* ---------- Customer / contact lists ---------- */

function customerRows(fileName: string, headers: string[], data: string[][]): ParsedFile {
  const col = (...n: string[]) => column(headers, ...n);
  const c = {
    display: col("display name", "customer name", "company name", "customer", "client name", "client", "company", "name"),
    first: col("first name", "contact first name"),
    last: col("last name", "contact last name"),
    email: col("email", "emailid", "email address", "customer email"),
    phone: col("phone", "mobilephone", "mobile", "phone number", "work phone"),
    a1: col("billing address", "address 1", "address line 1", "address", "billing street"),
    a2: col("billing street2", "address 2", "address line 2"),
    city: col("billing city", "city"),
    state: col("billing state", "state", "province/state", "province"),
    tin: col("tax id", "tin", "tax registration number", "vat number", "tax number"),
    type: col("contact type"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const isZoho = column(headers, "display name") >= 0 && column(headers, "contact id") >= 0;
  const customers: ImpCustomer[] = [];
  const seen = new Set<string>();
  for (const r of data) {
    if (c.type >= 0 && /vendor/i.test(get(r, c.type))) continue;
    const person = [get(r, c.first), get(r, c.last)].filter(Boolean).join(" ");
    const name = get(r, c.display) || person;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    customers.push({
      name,
      contactName: person && person !== name ? person : null,
      email: get(r, c.email).toLowerCase() || null,
      phone: get(r, c.phone) || null,
      address: [get(r, c.a1), get(r, c.a2), get(r, c.city), get(r, c.state)].filter(Boolean).join(", ") || null,
      tin: get(r, c.tin) || null,
    });
  }
  return {
    fileName, source: isZoho ? "ZOHO" : column(headers, "customer name / company") >= 0 ? "WAVE" : "CSV",
    label: isZoho ? "Zoho Books · Contacts export" : "Client list", customers, invoices: [],
    warnings: customers.length ? [] : ["No clients found in this file."], hasPayments: false, hasDueDates: false, hasLineDetails: false,
  };
}

/* ---------- Combining several files ---------- */

export type Frequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export type ImpRecurring = {
  key: string; customer: string; title: string; frequency: Frequency;
  /** Next invoice date, YYYY-MM-DD. */
  nextDate: string; endDate: string | null;
  lines: ImpLine[]; discount: number; vatAmount: number; total: number;
  /** "file": a recurring profile exported from the old tool. "detected": spotted from the invoice history. */
  origin: "file" | "detected";
  count: number;
};

export type Combined = {
  customers: ImpCustomer[];
  invoices: ImpInvoice[];
  source: ImportSource;
  hasPayments: boolean;
  hasDueDates: boolean;
  recurring: ImpRecurring[];
};

/** Clients merge by name (filling blanks); invoices merge by number, keeping the richer version. */
export function combine(files: ParsedFile[]): Combined {
  const customers = new Map<string, ImpCustomer>();
  for (const f of files) {
    for (const c of f.customers) {
      const key = norm(c.name);
      const prev = customers.get(key);
      customers.set(key, prev ? { ...prev, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v)), name: prev.name } : { ...c });
    }
  }
  const invoices = new Map<string, ImpInvoice>();
  const richness = (i: ImpInvoice) => i.lines.filter((l) => l.details).length * 2 + i.lines.length + (i.dueDate ? 1 : 0) + (i.paid != null ? 1 : 0);
  for (const f of files) {
    for (const inv of f.invoices) {
      const prev = invoices.get(inv.number);
      if (!prev) { invoices.set(inv.number, inv); continue; }
      const [rich, poor] = richness(inv) >= richness(prev) ? [inv, prev] : [prev, inv];
      invoices.set(inv.number, {
        ...rich,
        dueDate: rich.dueDate ?? poor.dueDate,
        paid: rich.paid ?? poor.paid,
        payments: rich.payments.length ? rich.payments : poor.payments,
        status: rich.status ?? poor.status,
      });
    }
  }
  for (const inv of invoices.values()) {
    const key = norm(inv.customer);
    if (inv.customer && !customers.has(key)) customers.set(key, { name: inv.customer });
  }
  const sources = new Set(files.map((f) => f.source));
  // Exported profiles win; history-based guesses only fill in clients that have no exported profile.
  const fromFiles = files.flatMap((f) => f.recurring ?? []);
  const covered = new Set(fromFiles.map((r) => norm(r.customer)));
  const detected = findRecurring([...invoices.values()]).filter((r) => !covered.has(norm(r.customer)));
  return {
    customers: [...customers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    invoices: [...invoices.values()].sort((a, b) => a.issueDate.localeCompare(b.issueDate) || numberPart(a.number) - numberPart(b.number)),
    source: sources.has("WAVE") ? "WAVE" : sources.has("ZOHO") ? "ZOHO" : "CSV",
    hasPayments: files.some((f) => f.hasPayments),
    hasDueDates: files.some((f) => f.hasDueDates),
    recurring: [...fromFiles, ...detected],
  };
}

/* ---------- Recurring invoices ---------- */

const PERIOD: Record<Frequency, { months: number; days: number }> = {
  WEEKLY: { months: 0, days: 7 }, MONTHLY: { months: 1, days: 0 }, QUARTERLY: { months: 3, days: 0 }, YEARLY: { months: 12, days: 0 },
};

/** Step a YYYY-MM-DD date forward by one period, keeping the day of month where the month allows. */
export function stepDate(d: string, f: Frequency) {
  const [y, m, day] = d.split("-").map(Number);
  const { months, days } = PERIOD[f];
  if (days) return new Date(Date.UTC(y, m - 1, day + days)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(day, last))).toISOString().slice(0, 10);
}

/** The first date in the series that's after today. */
export function nextAfterToday(from: string, f: Frequency, today = new Date().toISOString().slice(0, 10)) {
  let d = from;
  for (let i = 0; d <= today && i < 2000; i++) d = stepDate(d, f);
  return d;
}

/** "Monthly", "Every 3 months", repeat every 1 + "Weeks", 12 + "Months"… */
function frequencyOf(every: string, unit: string): Frequency | null {
  const n = Number((every.match(/\d+/) ?? [])[0] ?? 1) || 1;
  const u = norm(`${unit} ${every}`);
  if (/week/.test(u)) return n === 1 ? "WEEKLY" : null;
  if (/quarter/.test(u)) return n === 1 ? "QUARTERLY" : null;
  if (/year|annual/.test(u)) return n === 1 ? "YEARLY" : null;
  if (/month/.test(u)) return n === 1 ? "MONTHLY" : n === 3 ? "QUARTERLY" : n === 12 ? "YEARLY" : null;
  return null;
}

/** Zoho Books: Sales → Recurring Invoices → Export. One row per line item, grouped by profile. */
function recurringRows(fileName: string, headers: string[], data: string[][]): ParsedFile {
  const col = (...n: string[]) => column(headers, ...n);
  const c = {
    name: col("recurrence name", "profile name", "recurring invoice name"),
    customer: col("customer name", "customer", "client name", "client", "display name"),
    every: col("repeat every", "recurrence interval"),
    unit: col("recurrence frequency", "frequency", "repeat unit"),
    start: col("start date", "start on"),
    next: col("next invoice date", "next invoice on", "next date"),
    end: col("end date", "ends on"),
    status: col("status", "recurrence status"),
    item: col("item name", "product name", "item"),
    desc: col("item desc", "item description", "description"),
    qty: col("quantity", "qty"),
    rate: col("item price", "rate", "unit price"),
    itemTotal: col("item total", "line total"),
    itemTax: col("item tax amount", "tax amount"),
    discount: col("entity discount amount", "discount amount"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const order = pickOrder(data.flatMap((r) => [get(r, c.start), get(r, c.next), get(r, c.end)]));
  const profiles = new Map<string, (ImpRecurring & { tax: number }) | null>();
  let inactive = 0;
  let unsupported = 0;
  for (const r of data) {
    const customer = get(r, c.customer);
    if (!customer) continue;
    const title = get(r, c.name) || `${customer} recurring invoice`;
    const key = `${norm(customer)}|${norm(title)}`;
    if (!profiles.has(key)) {
      const frequency = frequencyOf(get(r, c.every), get(r, c.unit));
      if (c.status >= 0 && /stop|expir|inactive|ended/i.test(get(r, c.status))) { inactive++; profiles.set(key, null); continue; }
      if (!frequency) { unsupported++; profiles.set(key, null); continue; }
      const next = parseDate(get(r, c.next), order);
      const start = parseDate(get(r, c.start), order);
      profiles.set(key, {
        key: `file:${key}`, customer, title, frequency,
        nextDate: next && next > new Date().toISOString().slice(0, 10) ? next : nextAfterToday(next ?? start ?? new Date().toISOString().slice(0, 10), frequency),
        endDate: parseDate(get(r, c.end), order), lines: [], discount: Math.abs(parseMoney(get(r, c.discount)) || 0),
        vatAmount: 0, total: 0, origin: "file", count: 0, tax: 0,
      });
    }
    const p = profiles.get(key);
    if (!p) continue;
    const name = get(r, c.item) || get(r, c.desc).split("\n")[0];
    if (!name) continue;
    const qty = parseMoney(get(r, c.qty));
    const quantity = Number.isFinite(qty) && qty !== 0 ? qty : 1;
    const rate = parseMoney(get(r, c.rate));
    const lineTotal = parseMoney(get(r, c.itemTotal));
    const amount = round2(Number.isFinite(lineTotal) ? lineTotal : quantity * (Number.isFinite(rate) ? rate : 0));
    p.lines.push({ name, details: get(r, c.item) ? get(r, c.desc) || null : null, quantity, unitPrice: round2(amount / quantity), amount });
    p.tax = round2(p.tax + (parseMoney(get(r, c.itemTax)) || 0));
  }
  const recurring: ImpRecurring[] = [];
  for (const p of profiles.values()) {
    if (!p || !p.lines.length) continue;
    const { tax, ...rest } = p;
    const sub = round2(rest.lines.reduce((s, l) => s + l.amount, 0));
    recurring.push({ ...rest, vatAmount: tax, total: round2(sub - rest.discount + tax) });
  }
  const warnings: string[] = [];
  if (inactive) warnings.push(`${inactive} stopped or expired profile${inactive === 1 ? " was" : "s were"} left out.`);
  if (unsupported) warnings.push(`${unsupported} profile${unsupported === 1 ? " repeats" : "s repeat"} on a schedule BizBooks doesn't support yet (weekly, monthly, quarterly and yearly are), so ${unsupported === 1 ? "it was" : "they were"} left out.`);
  if (!recurring.length && !warnings.length) warnings.push("No recurring profiles found in this file.");
  return {
    fileName, source: "ZOHO", label: "Zoho Books · Recurring invoices export",
    customers: [...new Set(recurring.map((r) => r.customer))].map((name) => ({ name })), invoices: [], recurring, warnings,
    hasPayments: false, hasDueDates: false, hasLineDetails: c.desc >= 0,
  };
}

/**
 * Retainers hiding in the invoice history: same client, same amount, at a steady monthly, quarterly or
 * yearly rhythm. Monthly and quarterly need three invoices; yearly needs two.
 */
export function findRecurring(invoices: ImpInvoice[]): ImpRecurring[] {
  const groups = new Map<string, ImpInvoice[]>();
  for (const i of invoices) {
    if (i.status === "VOID" || !(i.total > 0)) continue;
    const k = `${norm(i.customer)}|${i.total.toFixed(2)}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const rhythms: [Frequency, number, number, number][] = [["MONTHLY", 25, 35, 3], ["QUARTERLY", 80, 100, 3], ["YEARLY", 350, 380, 2]];
  const out: ImpRecurring[] = [];
  for (const [k, list] of groups) {
    const sorted = [...list].sort((a, b) => a.issueDate.localeCompare(b.issueDate));
    const gaps = sorted.slice(1).map((x, i) => (Date.parse(x.issueDate) - Date.parse(sorted[i].issueDate)) / 86400000);
    for (const [frequency, lo, hi, min] of rhythms) {
      if (sorted.length < min) continue;
      const fit = gaps.filter((g) => g >= lo && g <= hi).length;
      if (fit < Math.max(min - 1, Math.ceil(gaps.length * 0.7))) continue;
      const last = sorted.at(-1)!;
      const name = frequency === "MONTHLY" ? "monthly retainer" : frequency === "QUARTERLY" ? "quarterly retainer" : "annual renewal";
      out.push({
        key: `detected:${k}`, customer: last.customer, title: `${last.customer} ${name}`, frequency,
        nextDate: nextAfterToday(last.issueDate, frequency), endDate: null,
        lines: last.lines, discount: last.discount, vatAmount: last.vatAmount, total: last.total, origin: "detected", count: sorted.length,
      });
      break;
    }
  }
  return out.sort((a, b) => b.total * b.count - a.total * a.count);
}
