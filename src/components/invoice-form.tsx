"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveInvoice } from "@/app/actions/invoices";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, inputClass, Notice, Select, Textarea } from "./ui";
import { computeTotals, money, naira, parseAmount } from "@/lib/money";
import { CURRENCIES } from "@/lib/currency";
import { TAX } from "@/lib/constants";
import { addDays, cn, dateInput } from "@/lib/utils";

type Line = { key: number; description: string; details: string; quantity: string; unitPrice: string };
type Customer = { id: string; name: string; phone: string | null; currency: string | null };

export type InvoiceFormProps = {
  kind: "INVOICE" | "QUOTE";
  customers: Customer[];
  savedItems: { name: string; description: string | null; unitPrice: number }[];
  vatRegistered: boolean;
  vatRate: number;
  termsDays: number;
  pro: boolean;
  /** Last rate used per currency, to prefill the exchange rate. */
  lastRates: Record<string, number>;
  initial?: {
    id: string; customerId: string; issueDate: string; dueDate: string; discount: number; vatRate: number; whtRate: number;
    notes: string; items: { description: string; details: string | null; quantity: number; unitPrice: number }[]; poNumber: string; depositPercent: number | null;
    title: string; summary: string; currency: string; exchangeRate: number;
  };
  preselectCustomer?: string;
};

let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, description: "", details: "", quantity: "1", unitPrice: "" });

export function InvoiceForm(p: InvoiceFormProps) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveInvoice, {});
  const e = state.errors ?? {};
  const isQuote = p.kind === "QUOTE";
  const today = new Date();

  const [customerId, setCustomerId] = useState(p.initial?.customerId ?? p.preselectCustomer ?? (p.customers.length ? "" : "new"));
  const [lines, setLines] = useState<Line[]>(
    p.initial?.items.length
      ? p.initial.items.map((i) => ({ key: nextKey++, description: i.description, details: i.details ?? "", quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
      : [blank()],
  );
  const [issueDate, setIssueDate] = useState(p.initial?.issueDate ?? dateInput(today));
  const [dueDate, setDueDate] = useState(p.initial?.dueDate ?? dateInput(addDays(today, p.termsDays)));
  const startCustomer = p.customers.find((c) => c.id === (p.initial?.customerId ?? p.preselectCustomer));
  const [currency, setCurrency] = useState(p.initial?.currency ?? startCustomer?.currency ?? "NGN");
  const [rate, setRate] = useState(String(p.initial?.exchangeRate && p.initial.exchangeRate !== 1 ? p.initial.exchangeRate : p.lastRates[p.initial?.currency ?? startCustomer?.currency ?? ""] ?? ""));
  const pickCurrency = (c: string) => {
    setCurrency(c);
    if (c !== "NGN") setRate((r) => (r && currency === c ? r : String(p.lastRates[c] ?? "")));
  };
  const fmt = (n: number) => money(n, currency);
  const [applyVat, setApplyVat] = useState(p.initial ? p.initial.vatRate > 0 : p.vatRegistered);
  const [discount, setDiscount] = useState(p.initial?.discount ? String(p.initial.discount) : "");
  const [whtRate, setWhtRate] = useState(String(p.initial?.whtRate ?? 0));
  const [deposit, setDeposit] = useState(String(p.initial?.depositPercent ?? (isQuote && p.pro ? 50 : 0)));
  const [more, setMore] = useState(!!(p.initial && (p.initial.discount || p.initial.whtRate || p.initial.notes)));

  const totals = useMemo(
    () => computeTotals(
      lines.map((l) => ({ description: l.description, quantity: parseAmount(l.quantity) || 0, unitPrice: parseAmount(l.unitPrice) || 0 })),
      parseAmount(discount) || 0, applyVat ? p.vatRate : 0, Number(whtRate),
    ),
    [lines, discount, applyVat, whtRate, p.vatRate],
  );

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const savedFor = (name: string) => p.savedItems.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
  const payload = JSON.stringify(lines.map(({ description, details, quantity, unitPrice }) => ({ description, details, quantity, unitPrice })));
  const [heading, setHeading] = useState(!!(p.initial?.title || p.initial?.summary));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="kind" value={p.kind} />
      {p.initial && <input type="hidden" name="id" value={p.initial.id} />}
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="exchangeRate" value={currency === "NGN" ? "1" : rate} />
      {state.message && <Notice tone="danger">{state.message}</Notice>}

      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <h2 className="text-lg">Who is it for?</h2>
        <div className="mt-3 space-y-4">
          {p.customers.length > 0 && (
            <Field label="Client" name="customerId" required error={customerId !== "new" ? e.customer : undefined}>
              <Select name="customerId" value={customerId} onChange={(ev) => {
                setCustomerId(ev.target.value);
                const c = p.customers.find((x) => x.id === ev.target.value);
                if (c?.currency && !p.initial) pickCurrency(c.currency);
              }} error={e.customer}>
                <option value="" disabled>Choose a client</option>
                {p.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
                <option value="new">+ Add a new client</option>
              </Select>
            </Field>
          )}
          {(customerId === "new" || p.customers.length === 0) && (
            <div className="grid gap-4 rounded-xl bg-canvas p-4 sm:grid-cols-3">
              {p.customers.length === 0 && <input type="hidden" name="customerId" value="new" />}
              <Field label="Client name" name="newCustomerName" required error={e.customer} className="sm:col-span-3">
                <Input name="newCustomerName" defaultValue={state.values?.newCustomerName} error={e.customer} autoComplete="off" />
              </Field>
              <Field label="Phone" name="newCustomerPhone" className="sm:col-span-1">
                <Input name="newCustomerPhone" type="tel" inputMode="tel" defaultValue={state.values?.newCustomerPhone} />
              </Field>
              <Field label="Billing email" name="newCustomerEmail" className="sm:col-span-2">
                <Input name="newCustomerEmail" type="email" inputMode="email" defaultValue={state.values?.newCustomerEmail} />
              </Field>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">What are you charging for?</h2>
          <button type="button" onClick={() => setHeading((h) => !h)} aria-expanded={heading} className="min-h-11 text-sm font-semibold text-brand hover:underline">
            {heading ? "Remove heading" : "Add a title and summary"}
          </button>
        </div>
        {heading && (
          <div className="mt-3 grid gap-4 rounded-xl bg-canvas p-4 sm:grid-cols-2">
            <Field label={`${isQuote ? "Quote" : "Invoice"} title`} name="title" hint={`Shown at the top in place of “${isQuote ? "Quote" : "Invoice"}”.`}>
              <Input name="title" maxLength={120} defaultValue={p.initial?.title ?? state.values?.title} placeholder="e.g. Website redesign & renewal" />
            </Field>
            <Field label="Summary" name="summary" hint="One line on what this covers.">
              <Input name="summary" maxLength={300} defaultValue={p.initial?.summary ?? state.values?.summary} placeholder="e.g. Upgrade of acme.com plus a year of hosting" />
            </Field>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">Currency</span>
            <select value={currency} onChange={(ev) => pickCurrency(ev.target.value)} aria-label="Invoice currency" className={cn(inputClass, "w-auto pr-8")}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
          </label>
          {currency !== "NGN" && (
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-muted">Exchange rate: 1 {currency} =</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">₦</span>
                <input inputMode="decimal" value={rate} onChange={(ev) => setRate(ev.target.value)} placeholder="e.g. 1,550" aria-label={`Naira per 1 ${currency}`} className={cn(inputClass, "num w-36 text-right")} />
              </span>
            </label>
          )}
        </div>
        {currency !== "NGN" && (
          <p className="mt-2 text-sm text-muted">
            Your client sees {currency}. Your books stay in naira: this invoice counts as {naira((parseAmount(rate) || 0) * totals.total)} in reports.
            When the money arrives you can record the day&apos;s actual rate.
          </p>
        )}
        {e.exchangeRate && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.exchangeRate}</p>}
        <datalist id="saved-items">
          {p.savedItems.map((i) => <option key={i.name} value={i.name} />)}
        </datalist>
        <ul className="mt-3 space-y-3">
          {lines.map((l, idx) => (
            <li key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_5rem_8rem_7rem_auto] sm:items-end sm:rounded-none sm:border-0 sm:border-b sm:px-0 sm:pb-4 sm:pt-0">
              <label className="col-span-2 sm:col-span-1">
                <span className={cn("mb-1 block text-xs font-semibold text-muted", idx > 0 && "sm:sr-only")}>Item or service</span>
                <input
                  className={inputClass}
                  list="saved-items"
                  value={l.description}
                  placeholder="e.g. Website redesign, phase 1"
                  aria-label={`Item ${idx + 1} name`}
                  onChange={(ev) => {
                    const description = ev.target.value;
                    const saved = savedFor(description);
                    update(l.key, {
                      description,
                      ...(saved && !l.unitPrice ? { unitPrice: String(saved.unitPrice) } : {}),
                      ...(saved?.description && !l.details ? { details: saved.description } : {}),
                    });
                  }}
                />
              </label>
              <label>
                <span className={cn("mb-1 block text-xs font-semibold text-muted", idx > 0 && "sm:sr-only")}>Qty</span>
                <input className={cn(inputClass, "num text-right")} inputMode="decimal" value={l.quantity} aria-label={`Item ${idx + 1} quantity`} onChange={(ev) => update(l.key, { quantity: ev.target.value })} />
              </label>
              <label>
                <span className={cn("mb-1 block text-xs font-semibold text-muted", idx > 0 && "sm:sr-only")}>Price ({currency})</span>
                <input className={cn(inputClass, "num text-right")} inputMode="decimal" value={l.unitPrice} placeholder="0" aria-label={`Item ${idx + 1} price`} onChange={(ev) => update(l.key, { unitPrice: ev.target.value })} />
              </label>
              <p className="num flex min-h-12 items-center justify-end font-semibold sm:justify-end" aria-label={`Item ${idx + 1} amount`}>
                {fmt((parseAmount(l.quantity) || 0) * (parseAmount(l.unitPrice) || 0))}
              </p>
              <button
                type="button"
                onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))}
                aria-label={`Remove item ${idx + 1}`}
                className="col-start-2 row-start-2 grid size-12 place-items-center self-end justify-self-end rounded-xl text-muted hover:bg-danger-wash hover:text-danger sm:col-start-auto sm:row-start-auto"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
              <label className="col-span-2 sm:col-span-4">
                <textarea
                  aria-label={`Item ${idx + 1} description`}
                  className={cn(inputClass, "min-h-16 py-2 text-sm")}
                  rows={Math.min(8, Math.max(2, l.details.split("\n").length))}
                  value={l.details}
                  placeholder="Description (optional): scope, deliverables or the period covered"
                  onChange={(ev) => update(l.key, { details: ev.target.value })}
                />
              </label>
            </li>
          ))}
        </ul>
        {e.items && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.items}</p>}
        <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold text-brand hover:bg-brand-wash">
          <Plus className="size-5" aria-hidden /> Add another item
        </button>

        <div className="mt-5 border-t border-line pt-4">
          {p.vatRegistered ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name="applyVat" checked={applyVat} onChange={(ev) => setApplyVat(ev.target.checked)} className="size-5 accent-brand" />
              <span>Add VAT ({p.vatRate}%)</span>
            </label>
          ) : (
            applyVat && <input type="hidden" name="applyVat" value="on" />
          )}
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="min-h-11 text-sm font-semibold text-brand hover:underline">
            {more ? "Hide" : "Add"} discount, withholding tax or a note
          </button>
          {more && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Discount (₦)" name="discount" error={e.discount}>
                <Input name="discount" inputMode="decimal" value={discount} onChange={(ev) => setDiscount(ev.target.value)} placeholder="0" className="num" />
              </Field>
              <Field label="Withholding tax" name="whtRate" hint="If this client deducts WHT before paying you, which most companies and government agencies do.">
                <Select name="whtRate" value={whtRate} onChange={(ev) => setWhtRate(ev.target.value)}>
                  {TAX.whtRates.map((w) => <option key={w.rate} value={w.rate}>{w.label}</option>)}
                </Select>
              </Field>
              <Field label="Note to client" name="notes" className="sm:col-span-2">
                <Textarea name="notes" defaultValue={p.initial?.notes ?? state.values?.notes} placeholder="e.g. Payment covers the October retainer as agreed in the SOW." />
              </Field>
            </div>
          )}
          {!more && <input type="hidden" name="whtRate" value={whtRate} />}
          {!more && <input type="hidden" name="discount" value={discount} />}
        </div>

        <dl className="num ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-soft"><dt>Subtotal</dt><dd>{fmt(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between text-ink-soft"><dt>Discount</dt><dd>−{fmt(totals.discount)}</dd></div>}
          {totals.vatAmount > 0 && <div className="flex justify-between text-ink-soft"><dt>VAT</dt><dd>{fmt(totals.vatAmount)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total</dt><dd>{fmt(totals.total)}</dd></div>
          {totals.whtAmount > 0 && (
            <div className="flex justify-between text-ink-soft"><dt>Client pays after WHT</dt><dd>{fmt(totals.amountDue)}</dd></div>
          )}
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <h2 className="text-lg">{isQuote ? "Dates" : "When should they pay?"}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={isQuote ? "Quote date" : "Invoice date"} name="issueDate" required>
            <Input name="issueDate" type="date" value={issueDate} onChange={(ev) => setIssueDate(ev.target.value)} />
          </Field>
          <Field label={isQuote ? "Valid until" : "Due date"} name="dueDate" required error={e.dueDate}>
            <Input name="dueDate" type="date" value={dueDate} onChange={(ev) => setDueDate(ev.target.value)} error={e.dueDate} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 7, 14, 30, 45].map((d) => (
            <button key={d} type="button" onClick={() => setDueDate(dateInput(addDays(new Date(issueDate || today), d)))} className="min-h-9 rounded-full border border-line-strong px-3 text-sm font-medium hover:border-ink">
              {d === 0 ? "Same day" : `${d} days`}
            </button>
          ))}
        </div>
        <Field label="Client's PO or reference number" name="poNumber" className="mt-4 sm:max-w-sm" hint="Many companies won't process an invoice without their purchase order number.">
          <Input name="poNumber" defaultValue={p.initial?.poNumber ?? state.values?.poNumber} autoComplete="off" />
        </Field>
        {isQuote && (
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">Ask for a deposit when they accept?</legend>
            <p className="text-sm text-muted">Your client accepts online and pays the deposit straight away. It's credited on the final invoice.</p>
            <input type="hidden" name="depositPercent" value={p.pro ? deposit : "0"} />
            <div className="mt-2 flex flex-wrap gap-2">
              {["0", "30", "50", "70"].map((d) => (
                <button key={d} type="button" disabled={!p.pro} aria-pressed={deposit === d} onClick={() => setDeposit(d)}
                  className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold disabled:opacity-50", deposit === d && p.pro ? "border-brand bg-brand-wash text-brand-deep" : "border-line-strong")}>
                  {d === "0" ? "No deposit" : `${d}%`}
                </button>
              ))}
            </div>
            {!p.pro && <p className="mt-2 text-sm text-muted">Deposits are a Pro feature. Clients can still accept the quote online.</p>}
          </fieldset>
        )}
      </section>

      <div className="sticky bottom-20 z-10 flex flex-col-reverse gap-3 rounded-2xl border border-line bg-paper/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <p className="num text-center font-bold sm:text-left">Total {fmt(totals.total)}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <SubmitButton variant="secondary" name="intent" value="draft" pending={pending}>Save as draft</SubmitButton>
          <SubmitButton name="intent" value="send" pending={pending} pendingText="Saving…">
            {p.initial ? "Save changes" : isQuote ? "Save and send quote" : "Save and send"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
