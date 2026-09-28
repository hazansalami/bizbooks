"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, MessageCircle, Send, Wallet, X } from "lucide-react";
import { emailInvoiceAction, markSharedAction, recordPayment } from "@/app/actions/invoices";
import { CopyButton, SubmitButton, useFormAction, type FormState } from "./form-bits";
import { buttonClass, Field, Input, Notice, Select, Textarea } from "./ui";
import { PAYMENT_METHODS } from "@/lib/constants";
import { dateInput } from "@/lib/utils";

export function SharePanel({ id, whatsappHref, link, hasEmail, customerName, kind, highlight, email }: {
  id: string; whatsappHref: string; link: string; hasEmail: boolean; customerName: string; kind: "send" | "reminder"; highlight?: boolean;
  /** Prefilled Email dialog: recipient, subject and message, all editable before sending. */
  email: { to: string; subject: string; message: string; copyTo: string };
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(emailInvoiceAction, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState<string | null>(null);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    if (state.ok) {
      dialog.current?.close();
      const t = setTimeout(() => setSent(state.message ?? "Sent."), 0);
      return () => clearTimeout(t);
    }
  }, [state]);

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
        <button type="button" onClick={() => { setSent(null); dialog.current?.showModal(); }} className={buttonClass("secondary", "lg", "w-full")}>
          <Mail className="size-5" aria-hidden /> Email
        </button>
        <span onClick={() => mark("link")}><CopyButton text={link} label="Copy link" className="min-h-13 w-full text-base" /></span>
      </div>
      {!hasEmail && !sent && <p className="mt-2 text-sm text-muted">{customerName} has no email saved yet. Tap Email to type one in; we&apos;ll remember it.</p>}
      {sent && <Notice tone="brand" className="mt-3">{sent}</Notice>}

      <dialog ref={dialog} aria-labelledby={`email-title-${id}`}
        className="m-auto w-[min(40rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]">
        <form onSubmit={onSubmit} className="flex max-h-[85dvh] flex-col" noValidate>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id={`email-title-${id}`} className="text-lg">{kind === "reminder" ? "Email a reminder" : "Email this invoice"}</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"><X className="size-5" aria-hidden /></button>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="kind" value={kind} />
            {state.message && !state.ok && <Notice tone="danger">{state.message}</Notice>}
            <Field label="To" name="to" required error={e.to} hint="Separate several addresses with commas.">
              <Input name="to" type="text" inputMode="email" autoComplete="email" defaultValue={v.to ?? email.to} placeholder="accounts@client.com" error={e.to} />
            </Field>
            <Field label="Subject" name="subject" required error={e.subject}>
              <Input name="subject" defaultValue={v.subject ?? email.subject} maxLength={200} error={e.subject} />
            </Field>
            <Field label="Message" name="message" required error={e.message}>
              <Textarea name="message" rows={8} defaultValue={v.message ?? email.message} maxLength={5000} error={e.message} className="min-h-44" />
            </Field>
            <p className="rounded-xl bg-canvas p-3 text-sm text-muted">
              Below your message we add the {kind === "reminder" || !link.includes("/pay/") ? "" : "“Pay now” button, "}invoice link and your bank details, so your client can pay straight away.
            </p>
            {email.copyTo && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" name="copyMe" defaultChecked className="size-5 accent-brand" /> Send me a copy at {email.copyTo}
              </label>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("ghost")}>Cancel</button>
            <SubmitButton pending={pending} pendingText="Sending…"><Send className="size-4" aria-hidden /> Send email</SubmitButton>
          </div>
        </form>
      </dialog>
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
