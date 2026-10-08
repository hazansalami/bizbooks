"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { addPaymentPromise } from "@/app/actions/collections";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { buttonClass, Field, Input, Notice } from "./ui";

/** "They said they'll pay on Friday": log it, the forecast expects it, and BizBooks chases if it slips. */
export function PromiseForm({ id, balance, currency }: { id: string; balance: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending } = useFormAction<FormState>(addPaymentPromise, {});
  const e = state.errors ?? {};
  if (state.ok) return <Notice tone="brand">{state.message}</Notice>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "sm")}>
        <CalendarCheck className="size-4" aria-hidden /> Log a promise to pay
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-paper p-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted">When the client tells you when they&apos;ll pay. If the date passes unpaid, BizBooks reminds them that they promised.</p>
      {state.message && <Notice tone="danger">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="They'll pay by" name="promisedFor" required error={e.promisedFor}><Input type="date" name="promisedFor" defaultValue={state.values?.promisedFor} error={e.promisedFor} /></Field>
        <Field label={`Amount (${currency})`} name="amount" error={e.amount}><Input name="amount" inputMode="decimal" defaultValue={state.values?.amount ?? String(balance)} error={e.amount} className="num" /></Field>
        <Field label="Note" name="note"><Input name="note" defaultValue={state.values?.note} placeholder="e.g. Said on a call with Tunde" /></Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm" pending={pending}>Save promise</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>Cancel</button>
      </div>
    </form>
  );
}
