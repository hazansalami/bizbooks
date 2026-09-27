"use client";

import { useState } from "react";
import { saveRecurringExpense } from "@/app/actions/expenses";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Select } from "./ui";
import { EXPENSE_CATEGORIES, FREQUENCIES, PAYMENT_METHODS, PAYROLL_CATEGORIES } from "@/lib/constants";
import { cn, dateInput } from "@/lib/utils";

export function RecurringExpenseForm({ initial, vatRegistered }: { initial?: Record<string, string> & { id: string }; vatRegistered: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveRecurringExpense, {});
  const e = state.errors ?? {};
  const v = { ...initial, ...state.values };
  const [frequency, setFrequency] = useState(v.frequency || "MONTHLY");
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {state.message && <Notice tone="sun">{state.message}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="title" required error={e.title}><Input name="title" defaultValue={v.title} placeholder="e.g. Office rent" error={e.title} /></Field>
        <Field label="Amount each time (₦)" name="amount" required error={e.amount}><Input name="amount" inputMode="decimal" defaultValue={v.amount} error={e.amount} className="num" /></Field>
        <Field label="Category" name="category" required error={e.category}>
          <Select name="category" defaultValue={v.category ?? ""} error={e.category}>
            <option value="" disabled>Choose</option>
            {EXPENSE_CATEGORIES.filter((c) => !PAYROLL_CATEGORIES.includes(c)).map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Paid to" name="vendor"><Input name="vendor" defaultValue={v.vendor} /></Field>
      </div>
      <Field label="How often?" name="frequency" error={e.frequency}>
        <input type="hidden" name="frequency" value={frequency} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(FREQUENCIES).map(([val, label]) => (
            <button key={val} type="button" aria-pressed={frequency === val} onClick={() => setFrequency(val)} className={cn("min-h-11 rounded-xl border text-sm font-semibold", frequency === val ? "border-brand bg-brand-wash text-brand-deep ring-2 ring-brand/30" : "border-line-strong")}>{label}</button>
          ))}
        </div>
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Next due" name="nextRunAt" required error={e.nextRunAt}><Input name="nextRunAt" type="date" defaultValue={v.nextRunAt ?? dateInput(new Date())} error={e.nextRunAt} /></Field>
        <Field label="Stop after" name="endAt" hint="Leave empty to keep going."><Input name="endAt" type="date" defaultValue={v.endAt} /></Field>
        <Field label="Paid by" name="method">
          <Select name="method" defaultValue={v.method ?? "BANK_TRANSFER"}>{["BANK_TRANSFER", "CASH", "POS", "OTHER"].map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m]}</option>)}</Select>
        </Field>
        {vatRegistered && <Field label="VAT included (₦)" name="vatAmount"><Input name="vatAmount" inputMode="decimal" defaultValue={v.vatAmount} className="num" /></Field>}
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-canvas p-4">
        <input type="checkbox" name="asBill" defaultChecked={v.asBill === "on"} className="mt-1 size-5 accent-brand" />
        <span><span className="font-semibold">Add it as a bill to pay</span><span className="block text-sm text-muted">It lands in “Bills you owe” until you mark it paid. Leave unticked for things that are charged automatically, like card subscriptions.</span></span>
      </label>
      <Field label="Bill is due" name="dueInDays" className="sm:max-w-xs">
        <Select name="dueInDays" defaultValue={v.dueInDays ?? "0"}>
          {[["0", "On the same day"], ["7", "7 days later"], ["14", "14 days later"], ["30", "30 days later"]].map(([val, l]) => <option key={val} value={val}>{l}</option>)}
        </Select>
      </Field>
      <SubmitButton size="lg" pending={pending}>{initial ? "Save changes" : "Add recurring expense"}</SubmitButton>
    </form>
  );
}
