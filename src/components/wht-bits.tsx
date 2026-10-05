"use client";

import { addWhtCredit, chaseWht, importWhtCredits } from "@/app/actions/wht";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Input, Notice, Select } from "./ui";

/** Upload the TaxPro-Max WHT credit list (CSV). */
export function CreditUpload() {
  const { state, onSubmit, pending } = useFormAction<FormState>(importWhtCredits, {});
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-wash file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-deep" />
        <SubmitButton size="sm" pending={pending} pendingText="Matching…">Upload and match</SubmitButton>
      </div>
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
    </form>
  );
}

/** Add one credit by hand (from a credit note a client sent). */
export function CreditForm({ invoices }: { invoices: { id: string; label: string }[] }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(addWhtCredit, {});
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <form onSubmit={onSubmit} key={state.ok ? state.message : "form"} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Deducted by
        <Input name="payerName" defaultValue={v.payerName} error={state.errors?.payerName} placeholder="Client company name" className="mt-1" />
      </label>
      <label className="text-sm font-semibold">Amount (₦)
        <Input name="amount" inputMode="decimal" defaultValue={v.amount} error={state.errors?.amount} className="num mt-1" />
      </label>
      <label className="text-sm font-semibold">Date on the credit note
        <Input name="date" type="date" defaultValue={v.date} error={state.errors?.date} className="mt-1" />
      </label>
      <label className="text-sm font-semibold">Receipt or credit note number <span className="font-normal text-muted">(optional)</span>
        <Input name="reference" defaultValue={v.reference} className="mt-1" />
      </label>
      {invoices.length > 0 && (
        <label className="text-sm font-semibold sm:col-span-2">For invoice <span className="font-normal text-muted">(optional, we&apos;ll try to match it)</span>
          <Select name="invoiceId" defaultValue={v.invoiceId ?? ""} className="mt-1">
            <option value="">Match it for me</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </Select>
        </label>
      )}
      <div className="sm:col-span-2">
        <SubmitButton size="sm" pending={pending}>Add credit</SubmitButton>
        {state.message && <Notice tone={state.ok ? "brand" : "danger"} className="mt-2">{state.message}</Notice>}
      </div>
    </form>
  );
}

/** "Ask for the credit note": emails the client (at most once a week per invoice). */
export function ChaseButton({ invoiceId }: { invoiceId: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(chaseWht, {});
  return (
    <form onSubmit={onSubmit} className="inline">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state.ok ? (
        <span className="text-xs font-semibold text-brand-deep">Sent</span>
      ) : (
        <SubmitButton size="sm" variant="secondary" pending={pending} pendingText="Sending…">Email client</SubmitButton>
      )}
      {state.message && !state.ok && <p className="mt-1 text-xs text-danger">{state.message}</p>}
    </form>
  );
}
