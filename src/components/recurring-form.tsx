"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveSchedule } from "@/app/actions/recurring";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, inputClass, Notice, Select, Textarea } from "./ui";
import { FREQUENCIES, TAX } from "@/lib/constants";
import { computeTotals, naira, parseAmount } from "@/lib/money";
import { cn, dateInput } from "@/lib/utils";

type Line = { key: number; description: string; quantity: string; unitPrice: string };
let k = 1;

export type RecurringInitial = {
  id: string; customerId: string; title: string; frequency: string; startAt: string; ends: "never" | "after" | "on";
  maxRuns: string; endAt: string; autoSend: boolean; dueInDays: number; applyVat: boolean; whtRate: number; notes: string;
  items: { description: string; quantity: number; unitPrice: number }[];
};

export function RecurringForm({ customers, vatRegistered, vatRate, termsDays, initial, preselectCustomer }: {
  customers: { id: string; name: string }[]; vatRegistered: boolean; vatRate: number; termsDays: number; initial?: RecurringInitial; preselectCustomer?: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveSchedule, {});
  const e = state.errors ?? {};
  const [lines, setLines] = useState<Line[]>(
    initial?.items.map((i) => ({ key: k++, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })) ?? [{ key: k++, description: "", quantity: "1", unitPrice: "" }],
  );
  const [ends, setEnds] = useState(initial?.ends ?? "never");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "MONTHLY");
  const [applyVat, setApplyVat] = useState(initial?.applyVat ?? vatRegistered);
  const [whtRate, setWhtRate] = useState(String(initial?.whtRate ?? 0));
  const totals = useMemo(() => computeTotals(lines.map((l) => ({ description: l.description, quantity: parseAmount(l.quantity) || 0, unitPrice: parseAmount(l.unitPrice) || 0 })), 0, applyVat ? vatRate : 0, Number(whtRate)), [lines, applyVat, vatRate, whtRate]);
  const up = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      {state.message && <Notice tone="sun">{state.message}</Notice>}

      <section className="space-y-4 rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer" name="customerId" required error={e.customerId}>
            <Select name="customerId" defaultValue={state.values?.customerId ?? initial?.customerId ?? preselectCustomer ?? ""} error={e.customerId}>
              <option value="" disabled>Choose a customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Name for this schedule" name="title" required error={e.title} hint="Only you see this.">
            <Input name="title" defaultValue={state.values?.title ?? initial?.title} placeholder="e.g. Monthly cleaning contract" error={e.title} />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">How often?</legend>
          <input type="hidden" name="frequency" value={frequency} />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(FREQUENCIES).map(([val, label]) => (
              <button key={val} type="button" aria-pressed={frequency === val} onClick={() => setFrequency(val)} className={cn("min-h-12 rounded-xl border text-sm font-semibold", frequency === val ? "border-brand bg-brand-wash text-brand-deep ring-2 ring-brand/30" : "border-line-strong")}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={initial ? "Next invoice date" : "First invoice date"} name="startAt" required error={e.startAt}>
            <Input name="startAt" type="date" defaultValue={state.values?.startAt ?? initial?.startAt ?? dateInput(new Date())} error={e.startAt} />
          </Field>
          <Field label="Customer has to pay within" name="dueInDays">
            <Select name="dueInDays" defaultValue={String(initial?.dueInDays ?? termsDays)}>
              {[[0, "Same day"], [7, "7 days"], [14, "14 days"], [30, "30 days"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">When should it stop?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[["never", "Keep going"], ["after", "After a number of invoices"], ["on", "On a date"]].map(([v, l]) => (
              <label key={v} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium", ends === v ? "border-brand bg-brand-wash text-brand-deep" : "border-line-strong")}>
                <input type="radio" name="ends" value={v} checked={ends === v} onChange={() => setEnds(v as typeof ends)} className="accent-brand" /> {l}
              </label>
            ))}
          </div>
          {ends === "after" && <Field label="Number of invoices" name="maxRuns" required error={e.maxRuns} className="mt-3 max-w-40"><Input name="maxRuns" inputMode="numeric" defaultValue={initial?.maxRuns ?? "12"} error={e.maxRuns} /></Field>}
          {ends === "on" && <Field label="Last date" name="endAt" required error={e.endAt} className="mt-3 max-w-56"><Input name="endAt" type="date" defaultValue={initial?.endAt} error={e.endAt} /></Field>}
        </fieldset>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
        <h2 className="text-lg">What's on each invoice?</h2>
        <ul className="mt-3 space-y-3">
          {lines.map((l, i) => (
            <li key={l.key} className="grid grid-cols-[1fr_5rem_7rem_auto] items-end gap-2">
              <input className={inputClass} value={l.description} placeholder="Item or service" aria-label={`Item ${i + 1}`} onChange={(ev) => up(l.key, { description: ev.target.value })} />
              <input className={cn(inputClass, "num text-right")} inputMode="decimal" value={l.quantity} aria-label={`Item ${i + 1} quantity`} onChange={(ev) => up(l.key, { quantity: ev.target.value })} />
              <input className={cn(inputClass, "num text-right")} inputMode="decimal" value={l.unitPrice} placeholder="₦" aria-label={`Item ${i + 1} price`} onChange={(ev) => up(l.key, { unitPrice: ev.target.value })} />
              <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} className="grid size-12 place-items-center rounded-xl text-muted hover:bg-danger-wash hover:text-danger"><Trash2 className="size-5" aria-hidden /></button>
            </li>
          ))}
        </ul>
        {e.items && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.items}</p>}
        <button type="button" onClick={() => setLines((ls) => [...ls, { key: k++, description: "", quantity: "1", unitPrice: "" }])} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold text-brand hover:bg-brand-wash">
          <Plus className="size-5" aria-hidden /> Add item
        </button>
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          {vatRegistered && (
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="applyVat" checked={applyVat} onChange={(ev) => setApplyVat(ev.target.checked)} className="size-5 accent-brand" /> Add VAT ({vatRate}%)</label>
          )}
          <Field label="Withholding tax" name="whtRate">
            <Select name="whtRate" value={whtRate} onChange={(ev) => setWhtRate(ev.target.value)}>
              {TAX.whtRates.map((w) => <option key={w.rate} value={w.rate}>{w.label}</option>)}
            </Select>
          </Field>
          <Field label="Note on every invoice" name="notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={initial?.notes} />
          </Field>
        </div>
        <p className="num mt-4 text-right text-lg font-bold">Each invoice: {naira(totals.total)}</p>
      </section>

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4">
        <input type="checkbox" name="autoSend" defaultChecked={initial?.autoSend ?? true} className="mt-1 size-5 accent-brand" />
        <span><span className="font-semibold">Email it to the customer automatically</span><span className="block text-sm text-muted">With a one-tap “Pay now” button. If they have no email, we'll put it in your invoices for you to send on WhatsApp.</span></span>
      </label>

      <SubmitButton size="lg" pending={pending}>{initial ? "Save changes" : "Start recurring invoice"}</SubmitButton>
    </form>
  );
}
