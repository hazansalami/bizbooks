"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { claimTransfer, payNow } from "@/app/actions/public";
import { CopyButton, SubmitButton, useFormAction, type FormState } from "@/components/form-bits";
import { buttonClass, Field, Input, Notice } from "@/components/ui";
import { naira } from "@/lib/money";

type Bank = { id: string; bankName: string; accountNumber: string; accountName: string };

export function PayPanel({ token, balance, online, providerName, needsEmail, banks, number, color, businessName }: {
  businessName: string; token: string; balance: number; online: boolean; providerName: string; needsEmail: boolean; banks: Bank[]; number: string; color: string;
}) {
  const pay = useFormAction<FormState>(payNow, {});
  const claim = useFormAction<FormState>(claimTransfer, {});
  const [claiming, setClaiming] = useState(false);

  return (
    <section id="pay" className="no-print scroll-mt-4 space-y-4 rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6">
      <p className="text-sm text-muted">Paying <strong className="text-ink">{businessName}</strong> · {number}</p>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">Amount to pay</h2>
        <p className="num text-3xl font-bold tracking-tight">{naira(balance)}</p>
      </div>

      {online && (
        <form onSubmit={pay.onSubmit} className="space-y-3">
          <input type="hidden" name="token" value={token} />
          {pay.state.message && <Notice tone="danger">{pay.state.message}</Notice>}
          {needsEmail && (
            <Field label="Your email, for the receipt" name="email" required error={pay.state.errors?.email}>
              <Input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={pay.state.values?.email} error={pay.state.errors?.email} />
            </Field>
          )}
          <SubmitButton size="lg" className="w-full text-lg" pending={pay.pending} pendingText="Opening secure checkout…">
            Pay {naira(balance)} now
          </SubmitButton>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <Lock className="size-3.5" aria-hidden /> Card, bank transfer or USSD · secured by {providerName}
          </p>
        </form>
      )}

      {banks.length > 0 && (
        <div className={online ? "border-t border-line pt-4" : ""}>
          <p className="font-semibold">{online ? "Or pay by bank transfer" : "Pay by bank transfer"}</p>
          <ul className="mt-2 space-y-2">
            {banks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas p-3">
                <div>
                  <p className="text-sm text-muted">{b.bankName}</p>
                  <p className="num text-xl font-bold tracking-wider">{b.accountNumber}</p>
                  <p className="text-sm">{b.accountName}</p>
                </div>
                <CopyButton text={b.accountNumber} label="Copy number" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Use <strong className="text-ink">{number}</strong> as the narration.</p>

          {claim.state.ok ? (
            <Notice tone="brand" className="mt-3">{claim.state.message}</Notice>
          ) : !claiming ? (
            <button type="button" onClick={() => setClaiming(true)} className={buttonClass("secondary", "lg", "mt-3 w-full")} style={{ borderColor: color }}>
              I've sent the transfer
            </button>
          ) : (
            <form onSubmit={claim.onSubmit} className="mt-3 space-y-3 rounded-xl border border-line p-4">
              <input type="hidden" name="token" value={token} />
              {claim.state.message && <Notice tone="danger">{claim.state.message}</Notice>}
              <Field label="Name on the account you paid from" name="payerName" required error={claim.state.errors?.payerName}>
                <Input name="payerName" autoComplete="name" defaultValue={claim.state.values?.payerName} error={claim.state.errors?.payerName} />
              </Field>
              <Field label="Amount sent (₦)" name="amount" required error={claim.state.errors?.amount}>
                <Input name="amount" inputMode="decimal" defaultValue={claim.state.values?.amount ?? String(balance)} error={claim.state.errors?.amount} className="num" />
              </Field>
              <Field label="Anything to add?" name="note">
                <Input name="note" defaultValue={claim.state.values?.note} placeholder="e.g. Sent from my Opay" />
              </Field>
              <SubmitButton className="w-full" pending={claim.pending} pendingText="Sending…">Let them know</SubmitButton>
            </form>
          )}
        </div>
      )}

      {!online && banks.length === 0 && <p className="text-muted">Contact the business for payment details.</p>}
    </section>
  );
}
