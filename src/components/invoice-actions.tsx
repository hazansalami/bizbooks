"use client";

import { useState } from "react";
import { Mail, MessageCircle, Wallet } from "lucide-react";
import { emailInvoiceAction, markSharedAction, recordPayment } from "@/app/actions/invoices";
import { CopyButton, SubmitButton, useFormAction, type FormState } from "./form-bits";
import { buttonClass, Field, Input, Notice, Select } from "./ui";
import { PAYMENT_METHODS } from "@/lib/constants";
import { dateInput } from "@/lib/utils";

export function SharePanel({ id, whatsappHref, link, hasEmail, customerName, kind, highlight }: {
  id: string; whatsappHref: string; link: string; hasEmail: boolean; customerName: string; kind: "send" | "reminder"; highlight?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(emailInvoiceAction, {});
  const mark = (channel: string) => {
    const f = new FormData();
    f.set("id", id);
    f.set("channel", channel);
    f.set("kind", kind);
    void markSharedAction(f);
  };
  return (
    <section className={highlight ? "rounded-2xl border-2 border-brand bg-brand-wash/50 p-4 sm:p-5" : "rounded-2xl border border-line bg-paper p-4 sm:p-5"}>
      <h2 className="text-lg">{highlight ? "Ready to go. How do you want to send it?" : kind === "reminder" ? "Send a reminder" : "Send it"}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <a href={whatsappHref} target="_blank" rel="noreferrer" onClick={() => mark("WhatsApp")} className={buttonClass("primary", "lg", "bg-[#1FAF5A] hover:bg-[#178F49]")}>
          <MessageCircle className="size-5" aria-hidden /> WhatsApp
        </a>
        <form onSubmit={onSubmit}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="kind" value={kind} />
          <SubmitButton variant="secondary" size="lg" className="w-full" pending={pending} pendingText="Sending…">
            <Mail className="size-5" aria-hidden /> Email
          </SubmitButton>
        </form>
        <span onClick={() => mark("link")}><CopyButton text={link} label="Copy link" className="min-h-13 w-full text-base" /></span>
      </div>
      {!hasEmail && !state.message && <p className="mt-2 text-sm text-muted">{customerName} has no email saved, so WhatsApp or the link is the way to go.</p>}
      {state.message && <Notice tone={state.ok ? "brand" : "danger"} className="mt-3">{state.message}</Notice>}
    </section>
  );
}

export function RecordPayment({ id, balance, currency = "NGN", invoiceRate = 1 }: { id: string; balance: number; currency?: string; invoiceRate?: number }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending } = useFormAction<FormState>(recordPayment, {});
  const e = state.errors ?? {};
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "lg", "w-full")}>
        <Wallet className="size-5" aria-hidden /> Record a payment
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <h2 className="text-lg">Record a payment</h2>
      <p className="text-sm text-muted">For cash, POS or transfers you've already seen in your bank app. Online payments record themselves.</p>
      <input type="hidden" name="id" value={id} />
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Amount received (${currency})`} name="amount" required error={e.amount}>
          <Input name="amount" inputMode="decimal" defaultValue={state.ok ? "" : state.values?.amount ?? String(balance)} error={e.amount} className="num" />
        </Field>
        <Field label="How did they pay?" name="method" required error={e.method}>
          <Select name="method" defaultValue={state.values?.method ?? "BANK_TRANSFER"}>
            {Object.entries(PAYMENT_METHODS).filter(([k]) => k !== "PAYSTACK" && k !== "FLUTTERWAVE").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Date" name="paidAt" required>
          <Input name="paidAt" type="date" defaultValue={state.values?.paidAt ?? dateInput(new Date())} />
        </Field>
      </div>
      {currency !== "NGN" && (
        <Field label={`Exchange rate on the day: ₦ per 1 ${currency}`} name="exchangeRate" hint={`The invoice used ₦${invoiceRate.toLocaleString("en-NG")}. Use what your bank actually converted at, so cash reports match your statement.`}>
          <Input name="exchangeRate" inputMode="decimal" defaultValue={state.values?.exchangeRate ?? String(invoiceRate)} className="num sm:max-w-48" />
        </Field>
      )}
      <Field label="Note" name="note">
        <Input name="note" defaultValue={state.ok ? "" : state.values?.note} placeholder="e.g. Paid part in cash at the shop" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Save payment</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Close</button>
      </div>
    </form>
  );
}
