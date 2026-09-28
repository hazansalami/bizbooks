"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";
import { combine, parseImportFile, type ParsedFile } from "@/lib/import/parse";
import { norm, numberPart } from "@/lib/import/values";
import { naira } from "@/lib/money";
import { FREE_RECURRING_LIMIT, FREQUENCIES } from "@/lib/constants";
import type { ImportResult } from "@/lib/import/save";
import { Badge, buttonClass, Notice } from "./ui";
import { cn, formatDate } from "@/lib/utils";

type Tab = "wave" | "zoho" | "other";

const GUIDES: Record<Tab, { title: string; steps: React.ReactNode[]; tip: string }> = {
  wave: {
    title: "From Wave",
    steps: [
      <>Go to <strong>Settings → Data Export</strong> and download <strong>Accounting</strong> and <strong>Sales</strong> as CSV. Upload every CSV file you get. We read the ones we recognise and tell you about any we don&apos;t.</>,
      <>Or use <strong>Reports → Account Transactions</strong>: set the date range to <strong>All time</strong> (from your first invoice), report type <strong>Accrual (Paid &amp; Unpaid)</strong>, and include <strong>Accounts Receivable</strong>, your <strong>sales/income</strong> accounts and <strong>VAT</strong>. Then Export → CSV.</>,
      <>For client emails and phone numbers, also export your <strong>customer list</strong> as CSV.</>,
    ],
    tip: "The Account Transactions report has clients, invoice numbers, services, amounts and VAT, but not due dates, quantities or line descriptions, and it only shows payments you recorded in Wave.",
  },
  zoho: {
    title: "From Zoho Books",
    steps: [
      <>Go to <strong>Sales → Invoices</strong>, open the <strong>⋯ menu → Export Invoices</strong>. Choose <strong>all invoices</strong>, format <strong>CSV</strong>, and include all fields.</>,
      <>Go to <strong>Sales → Customers → ⋯ → Export Customers</strong> as CSV for emails, phone numbers, addresses and Tax IDs.</>,
      <>Go to <strong>Sales → Recurring Invoices → ⋯ → Export</strong> as CSV so your retainers keep running without a gap. If you skip this, we still spot retainers from your invoice history.</>,
    ],
    tip: "Zoho's invoice export has everything: line items with descriptions, quantities, rates, tax, due dates and balances, so paid and unpaid invoices come across exactly.",
  },
  other: {
    title: "From a spreadsheet or another app",
    steps: [
      <>Save your invoice list as <strong>CSV</strong> with columns for <strong>invoice number</strong>, <strong>client</strong>, <strong>date</strong> and <strong>amount</strong>. Add due date, item, description, quantity, rate, VAT and balance if you have them.</>,
      <>One row per invoice or one row per line item both work. Rows with the same invoice number are combined.</>,
      <>A client list needs a <strong>name</strong> column, plus email, phone, address and TIN if you have them.</>,
    ],
    tip: "Excel files: use File → Save As → CSV first.",
  },
};

export function ImportWizard(p: { existingCustomers: string[]; existingNumbers: string[]; termsDays: number; nextNumber: string; prefix: string; pro: boolean; liveSchedules: number }) {
  const [tab, setTab] = useState<Tab>("wave");
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [paidMode, setPaidMode] = useState<"" | "paid" | "unpaid">("");
  const [createItems, setCreateItems] = useState(true);
  const [continueNumbering, setContinueNumbering] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [skipRecurring, setSkipRecurring] = useState<Set<string>>(new Set());
  const [recurringActive, setRecurringActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const data = useMemo(() => combine(files), [files]);
  const known = useMemo(() => new Set(p.existingNumbers), [p.existingNumbers]);
  const existingNames = useMemo(() => new Set(p.existingCustomers.map(norm)), [p.existingCustomers]);
  const fresh = data.invoices.filter((i) => !known.has(i.number));
  const unknownPaid = fresh.filter((i) => i.paid == null && i.status == null && !i.payments.length);
  const newClients = data.customers.filter((c) => !existingNames.has(norm(c.name)));
  const retainers = data.recurring;
  const chosen = retainers.filter((r) => !skipRecurring.has(r.key));
  const room = p.pro ? Infinity : Math.max(0, FREE_RECURRING_LIMIT - p.liveSchedules);
  const maxNo = Math.max(0, ...fresh.map((i) => numberPart(i.number)).filter(Number.isFinite));
  const total = fresh.reduce((s, i) => s + i.total, 0);
  const vat = fresh.reduce((s, i) => s + i.vatAmount, 0);
  const services = new Set(fresh.flatMap((i) => i.lines.filter((l) => l.unitPrice > 0).map((l) => norm(l.name)))).size;
  const range = fresh.length ? [fresh[0].issueDate, fresh.at(-1)!.issueDate] : null;
  const needsChoice = unknownPaid.length > 0 && !paidMode;

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const parsed: ParsedFile[] = [];
    const bad: string[] = [];
    for (const f of Array.from(list)) {
      if (!/\.(csv|txt)$/i.test(f.name)) { bad.push(`${f.name}: save it as CSV first (File → Save As → CSV).`); continue; }
      if (f.size > 15_000_000) { bad.push(`${f.name}: this file is over 15 MB. Export a shorter date range, then import the rest separately.`); continue; }
      parsed.push(parseImportFile(f.name, await f.text()));
    }
    setFiles((prev) => [...prev.filter((x) => !parsed.some((y) => y.fileName === x.fileName)), ...parsed]);
    setRejected(bad);
    setResult(null);
    setError("");
  }

  async function runImport() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: data.source, paidMode: paidMode || "unpaid", createItems, continueNumbering, recurringActive,
          recurring: chosen.map(({ key, count, ...r }) => { void key; void count; return r; }),
          customers: data.customers,
          invoices: fresh.map(({ issues, currency, ...i }) => { void issues; void currency; return i; }),
        }),
      });
      const json = await res.json().catch(() => ({ error: "The server didn't respond. Please try again." }));
      if (!res.ok) setError(json.error ?? "The import failed and nothing was saved.");
      else setResult(json as ImportResult);
    } catch {
      setError("You seem to be offline. Nothing was saved; try again when you're connected.");
    } finally {
      setBusy(false);
    }
  }

  if (result) return <Done r={result} source={data.source} onAgain={() => { setFiles([]); setResult(null); setPaidMode(""); }} />;

  return (
    <div className="space-y-6">
      {/* 1. What to export */}
      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <h2 className="text-lg">1. Export from your old software</h2>
        <div role="tablist" aria-label="Where are your books now?" className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(GUIDES) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", tab === t ? "border-brand bg-brand-wash text-brand-deep" : "border-line-strong hover:border-ink")}>
              {GUIDES[t].title}
            </button>
          ))}
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-soft">
          {GUIDES[tab].steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <p className="mt-3 rounded-xl bg-canvas p-3 text-sm text-muted">{GUIDES[tab].tip}</p>
      </section>

      {/* 2. Upload */}
      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <h2 className="text-lg">2. Upload the CSV files</h2>
        <p className="mt-1 text-sm text-muted">Add as many as you like. Invoices and client lists are matched up automatically. Nothing is saved yet.</p>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn("mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center", dragging ? "border-brand bg-brand-wash" : "border-line-strong hover:border-ink")}
        >
          <Upload className="size-7 text-brand" aria-hidden />
          <span className="font-semibold">Drop CSV files here, or choose files</span>
          <span className="text-sm text-muted">Wave, Zoho Books or any invoice or client CSV</span>
          <input ref={input} type="file" accept=".csv,text/csv,.txt" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
        {rejected.map((r) => <p key={r} role="alert" className="mt-2 text-sm font-medium text-danger">{r}</p>)}

        {files.length > 0 && (
          <ul className="mt-4 space-y-3">
            {files.map((f) => (
              <li key={f.fileName} className="rounded-xl border border-line p-3">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{f.fileName}</p>
                    <p className="text-sm text-muted">
                      {f.label}
                      {f.invoices.length > 0 && ` · ${plural(f.invoices.length, "invoice")}`}
                      {f.customers.length > 0 && ` · ${plural(f.customers.length, "client")}`}
                      {f.from && f.to && ` · ${formatDate(f.from)} – ${formatDate(f.to)}`}
                    </p>
                    {f.warnings.map((w) => <p key={w} className="mt-1 flex gap-1.5 text-sm text-sun-ink"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{w}</p>)}
                  </div>
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((x) => x !== f))} aria-label={`Remove ${f.fileName}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink">
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Review */}
      {data.invoices.length + data.customers.length > 0 && (
        <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
          <h2 className="text-lg">3. Check what we found</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Fact label="Invoices" value={String(fresh.length)} hint={range ? `${formatDate(range[0])} – ${formatDate(range[1])}` : undefined} />
            <Fact label="Invoiced" value={naira(total)} hint={vat ? `incl. ${naira(vat)} VAT` : "no VAT found"} />
            <Fact label="Clients" value={String(data.customers.length)} hint={`${newClients.length} new`} />
            <Fact label="Services" value={String(services)} hint="added to your items list" />
          </dl>
          {data.invoices.length > fresh.length && (
            <Notice tone="info" className="mt-4">{data.invoices.length - fresh.length} invoice{data.invoices.length - fresh.length === 1 ? " is" : "s are"} already in BizBooks with the same number and will be skipped, so importing twice is safe.</Notice>
          )}

          {unknownPaid.length > 0 && (
            <fieldset className="mt-5 rounded-xl border border-sun/60 bg-sun-wash/40 p-4">
              <legend className="px-1 font-semibold">Which of these invoices have been paid?</legend>
              <p className="text-sm text-ink-soft">
                {unknownPaid.length === fresh.length ? "This file doesn't" : `${unknownPaid.length} invoice${unknownPaid.length === 1 ? "" : "s"} don't`} say whether they were paid. Choose what fits; you can mark individual invoices paid or unpaid afterwards.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {([["paid", "They're all paid", "Best for past years. Your cash-flow reports treat each as paid on its due date."], ["unpaid", "Treat them as unpaid", "Each shows as owed until you record a payment. Nothing is sent to clients."]] as const).map(([v, t, d]) => (
                  <label key={v} className={cn("flex cursor-pointer gap-3 rounded-xl border bg-paper p-3", paidMode === v ? "border-brand ring-2 ring-brand/30" : "border-line-strong")}>
                    <input type="radio" name="paidMode" value={v} checked={paidMode === v} onChange={() => setPaidMode(v)} className="mt-1 size-4 accent-brand" />
                    <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted">{d}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-5 space-y-2">
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={createItems} onChange={(e) => setCreateItems(e.target.checked)} className="size-5 accent-brand" /> Add services to my items list with their latest price and description</label>
            {maxNo > 0 && (
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" checked={continueNumbering} onChange={(e) => setContinueNumbering(e.target.checked)} className="size-5 accent-brand" />
                Continue my invoice numbers: next invoice will be {p.prefix}-{String(Math.max(maxNo + 1, numberPart(p.nextNumber) || 0)).padStart(4, "0")}
              </label>
            )}
          </div>

          {!data.hasDueDates && fresh.length > 0 && <p className="mt-3 text-sm text-muted">Due dates aren&apos;t in {files.length > 1 ? "these files" : "this file"}, so each invoice uses your {p.termsDays}-day payment terms.</p>}
          {retainers.length > 0 && (
            <fieldset className="mt-5 rounded-xl border border-line p-4">
              <legend className="flex items-center gap-2 px-1 font-semibold"><RefreshCw className="size-4 text-brand" aria-hidden /> Recurring invoices</legend>
              <p className="text-sm text-muted">
                {retainers.some((r) => r.origin === "detected") ? "We spotted clients billed the same amount on a steady schedule. " : ""}
                Ticked ones are set up as recurring invoices, so the next one goes out on its own.
              </p>
              <ul className="mt-3 divide-y divide-line">
                {retainers.map((r) => {
                  const on = !skipRecurring.has(r.key);
                  return (
                    <li key={r.key}>
                      <label className="flex cursor-pointer items-start gap-3 py-3">
                        <input type="checkbox" checked={on} className="mt-1 size-5 accent-brand"
                          onChange={() => setSkipRecurring((prev) => { const n = new Set(prev); if (on) n.add(r.key); else n.delete(r.key); return n; })} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{r.customer}: {naira(r.total)} {(FREQUENCIES as Record<string, string>)[r.frequency]?.toLowerCase() ?? r.frequency.toLowerCase()}</span>
                          <span className="block text-sm text-muted">
                            {r.lines.map((l) => l.name).join(", ")} · next on {formatDate(r.nextDate)}
                            {r.origin === "detected" ? ` · spotted from ${r.count} past invoices` : " · from your recurring invoices export"}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([[false, "Start paused", "Check each one first, then press Resume."], [true, "Start sending", "Each goes out by email on its next date."]] as const).map(([v, t, d]) => (
                  <label key={t} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", recurringActive === v ? "border-brand ring-2 ring-brand/30" : "border-line-strong")}>
                    <input type="radio" name="recurringActive" checked={recurringActive === v} onChange={() => setRecurringActive(v)} className="mt-1 size-4 accent-brand" />
                    <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted">{d}</span></span>
                  </label>
                ))}
              </div>
              {chosen.length > room && (
                <p className="mt-3 text-sm text-sun-ink">
                  The Free plan includes {FREE_RECURRING_LIMIT} recurring invoices{p.liveSchedules ? ` and you have ${p.liveSchedules}` : ""}, so only the first {room} will be set up. <Link href="/app/settings/billing" className="font-semibold underline">Pro</Link> has no limit.
                </p>
              )}
            </fieldset>
          )}

          {/* Invoice preview */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">No.</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Client</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Services</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...data.invoices].reverse().slice(0, showAll ? undefined : 12).map((i) => {
                  const dup = known.has(i.number);
                  const unknown = i.paid == null && i.status == null && !i.payments.length;
                  const paid = i.status === "VOID" ? 0 : unknown ? (paidMode === "paid" ? i.total : 0) : i.paid ?? (i.status === "PAID" ? i.total : 0);
                  return (
                    <tr key={i.number} className={cn("border-t border-line align-top", dup && "opacity-50")}>
                      <td className="num px-3 py-2 font-medium">{i.number}</td>
                      <td className="num whitespace-nowrap px-3 py-2">{formatDate(i.issueDate)}</td>
                      <td className="px-3 py-2">{i.customer}</td>
                      <td className="px-3 py-2 text-ink-soft">
                        {i.lines.map((l) => l.name).join(", ")}
                        {i.issues.map((x) => <span key={x} className="mt-1 flex gap-1 text-xs text-sun-ink"><AlertTriangle className="size-3.5 shrink-0" aria-hidden />{x}</span>)}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">{naira(i.total)}</td>
                      <td className="px-3 py-2">
                        {dup ? <Badge>Already here</Badge>
                          : i.status === "VOID" ? <Badge>Void</Badge>
                          : unknown && !paidMode ? <Badge tone="sun">Choose above</Badge>
                          : paid >= i.total - 0.005 ? <Badge tone="brand">Paid</Badge>
                          : paid > 0 ? <Badge tone="info">Part paid</Badge>
                          : <Badge tone="sun">Unpaid</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.invoices.length > 12 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 min-h-11 text-sm font-semibold text-brand hover:underline">
              {showAll ? "Show fewer" : `Show all ${data.invoices.length} invoices`}
            </button>
          )}

          {data.customers.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold">Clients</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.customers.map((c) => (
                  <li key={c.name} className="rounded-full border border-line px-3 py-1 text-sm">
                    {c.name}{c.email ? <span className="text-muted"> · {c.email}</span> : null}
                    {existingNames.has(norm(c.name)) && <span className="text-muted"> (already here)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <Notice tone="danger" className="mt-5">{error}</Notice>}
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Imported invoices never trigger reminders or emails to your clients.</p>
            <button type="button" onClick={runImport} disabled={busy || needsChoice || (!fresh.length && !newClients.length)} className={buttonClass("primary", "md")}>
              {busy ? "Importing…" : `Import ${fresh.length} invoice${fresh.length === 1 ? "" : "s"} and ${newClients.length} new client${newClients.length === 1 ? "" : "s"}`}
            </button>
          </div>
          {needsChoice && <p className="mt-2 text-right text-sm font-medium text-sun-ink">Answer “Which of these invoices have been paid?” first.</p>}
        </section>
      )}
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="num mt-1 text-xl font-bold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function Done({ r, source, onAgain }: { r: ImportResult; source: string; onAgain: () => void }) {
  const from = source === "WAVE" ? "Wave" : source === "ZOHO" ? "Zoho Books" : "your file";
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-paper p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-brand" aria-hidden />
        <h2 className="mt-3 text-2xl">Your books are in</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-soft">
          We brought across {r.invoicesCreated} invoice{r.invoicesCreated === 1 ? "" : "s"}, {r.customersCreated} new client{r.customersCreated === 1 ? "" : "s"}
          {r.customersUpdated ? ` (and filled in details for ${r.customersUpdated} existing)` : ""}, {r.paymentsCreated} payment{r.paymentsCreated === 1 ? "" : "s"}
          {r.itemsCreated ? `, ${r.itemsCreated} services` : ""}{r.recurringCreated ? ` and ${r.recurringCreated} recurring invoice${r.recurringCreated === 1 ? "" : "s"}` : ""} from {from}.
          {r.nextNumber && <> Your next invoice will be <strong>{r.nextNumber}</strong>.</>}
        </p>
        {r.recurringOverLimit.length > 0 && <p className="mt-2 text-sm text-sun-ink">Not set up (Free plan limit): {r.recurringOverLimit.join(", ")}. <Link href="/app/settings/billing" className="font-semibold underline">Upgrade to Pro</Link> to add them.</p>}
        {r.skipped.length > 0 && <p className="mt-2 text-sm text-muted">Skipped {r.skipped.length} already in BizBooks: {r.skipped.slice(0, 8).join(", ")}{r.skipped.length > 8 ? "…" : ""}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/app" className={buttonClass("primary")}>See your overview</Link>
          <Link href="/app/invoices" className={buttonClass("secondary")}>View invoices</Link>
          {r.recurringCreated > 0 && <Link href="/app/recurring" className={buttonClass("secondary")}>Recurring invoices</Link>}
          <Link href="/app/reports" className={buttonClass("secondary")}>Reports</Link>
          <button type="button" onClick={onAgain} className={buttonClass("ghost")}>Import another file</button>
        </div>
      </section>

    </div>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
