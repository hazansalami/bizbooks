"use client";

import { CheckCircle2 } from "lucide-react";
import { acceptQuote } from "@/app/actions/public";
import { SubmitButton, useFormAction, type FormState } from "@/components/form-bits";
import { Field, Input, Notice } from "@/components/ui";
import { naira } from "@/lib/money";

export function QuoteAccept({ token, businessName, number, total, deposit, depositPercent }: {
  token: string; businessName: string; number: string; total: number; deposit: number; depositPercent: number | null;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(acceptQuote, {});
  if (state.ok) {
    return (
      <div className="no-print flex items-center gap-3 rounded-2xl bg-brand-wash p-4 text-brand-deep">
        <CheckCircle2 className="size-6 shrink-0" aria-hidden /><p>{state.message}</p>
      </div>
    );
  }
  return (
    <section className="no-print space-y-4 rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6">
      <p className="text-sm text-muted">Quote from <strong className="text-ink">{businessName}</strong> · {number}</p>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">Quote total</h2>
        <p className="num text-3xl font-bold tracking-tight">{naira(total)}</p>
      </div>
      {depositPercent ? (
        <p className="rounded-xl bg-canvas p-3 text-sm text-ink-soft">
          To confirm the project, {businessName} asks for a <strong className="text-ink">{depositPercent}% deposit of {naira(deposit)}</strong>{" "}
          (plus any VAT). You'll pay it straight after accepting, and it's deducted from the final invoice.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        {state.message && <Notice tone="danger">{state.message}</Notice>}
        <Field label="Your name" name="acceptedBy" required error={state.errors?.acceptedBy} hint="So they know who approved it.">
          <Input name="acceptedBy" autoComplete="name" defaultValue={state.values?.acceptedBy} error={state.errors?.acceptedBy} />
        </Field>
        <SubmitButton size="lg" className="w-full" pending={pending} pendingText="Confirming…">
          {depositPercent ? `Accept and pay ${depositPercent}% deposit` : "Accept this quote"}
        </SubmitButton>
      </form>
    </section>
  );
}
