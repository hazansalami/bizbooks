"use client";

import { bankLineToExpense, bankLineToPayment, importBankStatement } from "@/app/actions/bank";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Input, Notice } from "./ui";

export function StatementUpload({ accounts }: { accounts: string[] }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(importBankStatement, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required aria-label="Statement file" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-wash file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-deep" />
        <label className="text-sm font-semibold">Account <span className="font-normal text-muted">(optional)</span>
          <Input name="account" list="bank-accounts" placeholder="e.g. GTBank current" className="mt-1 w-52" />
          <datalist id="bank-accounts">{accounts.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <SubmitButton size="sm" pending={pending} pendingText="Reading…">Upload statement</SubmitButton>
      </div>
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
    </form>
  );
}

const selectClass = "min-h-9 max-w-64 rounded-lg border border-line-strong bg-paper px-2 text-sm";

/** Money in: pick the invoice it pays. */
export function LineToPayment({ id, invoices }: { id: string; invoices: { id: string; label: string }[] }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(bankLineToPayment, {});
  if (!invoices.length) return null;
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="invoiceId" aria-label="Invoice this payment is for" className={selectClass} defaultValue="">
        <option value="" disabled>Payment for invoice…</option>
        {invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
      </select>
      <SubmitButton size="sm" variant="secondary" pending={pending}>Record</SubmitButton>
      {state.message && !state.ok && <p className="w-full text-xs text-danger">{state.message}</p>}
    </form>
  );
}

/** Money out: add as an expense. */
export function LineToExpense({ id, categories, guess }: { id: string; categories: string[]; guess?: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(bankLineToExpense, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="category" aria-label="Expense category" className={selectClass} defaultValue={guess ?? ""}>
        <option value="" disabled>Expense for…</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <SubmitButton size="sm" variant="secondary" pending={pending}>Add expense</SubmitButton>
      {state.message && !state.ok && <p className="w-full text-xs text-danger">{state.message}</p>}
    </form>
  );
}
