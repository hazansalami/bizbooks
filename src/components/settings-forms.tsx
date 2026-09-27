"use client";

import { useState } from "react";
import { addBankAction, connectGatewayAction, saveProfile } from "@/app/actions/settings";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Select, Textarea } from "./ui";
import { BANKS, ENTITY_TYPES, NIGERIAN_STATES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ColorPicker, LogoPicker } from "@/app/onboarding/steps";

type Profile = {
  legalName: string; rcNumber: string; entityType: string; professionalServices: boolean; payDay: number;
  name: string; email: string; phone: string; address: string; city: string; state: string; tin: string; vatRegistered: boolean; vatRate: number;
  invoicePrefix: string; paymentTermsDays: number; invoiceFooter: string; autoReminders: boolean; logo: string; brandColor: string;
};

export function ProfileForm({ p, pro }: { p: Profile; pro: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveProfile, {});
  const e = state.errors ?? {};
  const [vat, setVat] = useState(p.vatRegistered);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
      <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <h2 className="text-lg">Company details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Trading name" name="name" required error={e.name}><Input name="name" defaultValue={p.name} error={e.name} /></Field>
          <Field label="Registered name" name="legalName" hint="If different from your trading name."><Input name="legalName" defaultValue={p.legalName} /></Field>
          <Field label="Registered as" name="entityType">
            <Select name="entityType" defaultValue={p.entityType}>{Object.entries(ENTITY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          </Field>
          <Field label="CAC number (RC or BN)" name="rcNumber"><Input name="rcNumber" defaultValue={p.rcNumber} /></Field>
          <Field label="Phone" name="phone"><Input name="phone" type="tel" inputMode="tel" defaultValue={p.phone} /></Field>
          <Field label="Email" name="email" error={e.email} hint="Customer replies and payment alerts go here."><Input name="email" type="email" defaultValue={p.email} error={e.email} /></Field>
          <Field label="Address" name="address" className="sm:col-span-2"><Input name="address" defaultValue={p.address} /></Field>
          <Field label="City or area" name="city"><Input name="city" defaultValue={p.city} /></Field>
          <Field label="State" name="state">
            <Select name="state" defaultValue={p.state}><option value="">Choose a state</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <h2 className="text-lg">Look and feel</h2>
        <LogoPicker defaultLogo={p.logo} error={e.logo} />
        <div><p className="mb-2 text-sm font-semibold">Brand colour</p><ColorPicker defaultColor={p.brandColor} /></div>
        {!pro && <p className="text-sm text-muted">Free invoices carry a small “Created with BizBooks” line. Pro removes it and uses your colour in emails.</p>}
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <h2 className="text-lg">Invoices and tax</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Invoice number prefix" name="invoicePrefix" error={e.invoicePrefix} hint="e.g. INV gives INV-0001"><Input name="invoicePrefix" defaultValue={p.invoicePrefix} error={e.invoicePrefix} className="uppercase" /></Field>
          <Field label="Default payment terms" name="paymentTermsDays">
            <Select name="paymentTermsDays" defaultValue={String(p.paymentTermsDays)}>
              {[[0, "Due immediately"], [7, "Within 7 days"], [14, "Within 14 days"], [30, "Within 30 days"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Tax ID (TIN)" name="tin"><Input name="tin" defaultValue={p.tin} inputMode="numeric" /></Field>
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="vatRegistered" checked={vat} onChange={(ev) => setVat(ev.target.checked)} className="mt-1 size-5 accent-brand" />
          <span><span className="font-semibold">I'm VAT registered</span><span className="block text-sm text-muted">Adds a VAT option to your invoices and a VAT summary to your reports.</span></span>
        </label>
        {vat && <Field label="VAT rate (%)" name="vatRate" error={e.vatRate} className="max-w-40"><Input name="vatRate" inputMode="decimal" defaultValue={String(p.vatRate)} error={e.vatRate} /></Field>}
        <label className="flex items-start gap-3">
          <input type="checkbox" name="professionalServices" defaultChecked={p.professionalServices} className="mt-1 size-5 accent-brand" />
          <span><span className="font-semibold">We provide professional services</span><span className="block text-sm text-muted">Consulting, legal, accounting, engineering and similar. These firms can't use the small-company income tax exemption.</span></span>
        </label>
        <Field label="Salary pay day" name="payDay" hint="Day of the month you usually pay staff. Weekends move to the Friday before." className="max-w-48">
          <Input name="payDay" inputMode="numeric" defaultValue={String(p.payDay)} />
        </Field>
        <Field label="Footer on every invoice" name="invoiceFooter" hint="e.g. late-payment terms, or “Please quote the invoice number when paying.”">
          <Textarea name="invoiceFooter" defaultValue={p.invoiceFooter} />
        </Field>
        <label className={cn("flex items-start gap-3", !pro && "opacity-70")}>
          <input type="checkbox" name="autoReminders" defaultChecked={p.autoReminders} className="mt-1 size-5 accent-brand" />
          <span><span className="font-semibold">Send payment reminders automatically</span><span className="block text-sm text-muted">1 day before the due date, then 3 and 7 days after. Email only; stops the moment they pay.{!pro && " Pro feature."}</span></span>
        </label>
      </section>
      <SubmitButton size="lg" pending={pending}>Save settings</SubmitButton>
    </form>
  );
}

export function AddBankForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(addBankAction, {});
  const e = state.errors ?? {};
  const v = state.ok ? {} : state.values ?? {};
  return (
    <form key={state.ok ? state.message : "f"} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Bank" name="bankName" required error={e.bankName}>
          <Select name="bankName" defaultValue={v.bankName ?? ""} error={e.bankName}><option value="" disabled>Choose</option>{BANKS.map((b) => <option key={b}>{b}</option>)}</Select>
        </Field>
        <Field label="Account number" name="accountNumber" required error={e.accountNumber}>
          <Input name="accountNumber" inputMode="numeric" maxLength={10} defaultValue={v.accountNumber} error={e.accountNumber} className="num" />
        </Field>
        <Field label="Account name" name="accountName" required error={e.accountName}>
          <Input name="accountName" defaultValue={v.accountName} error={e.accountName} />
        </Field>
      </div>
      <SubmitButton variant="secondary" pending={pending}>Add bank account</SubmitButton>
    </form>
  );
}

export function ConnectGatewayForm({ provider, connected }: { provider: "PAYSTACK" | "FLUTTERWAVE"; connected: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(connectGatewayAction, {});
  const paystack = provider === "PAYSTACK";
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="provider" value={provider} />
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
      <Field label={connected ? "Replace secret key" : "Secret key"} name="secretKey" required error={state.errors?.secretKey}>
        <Input name="secretKey" autoComplete="off" spellCheck={false} placeholder={paystack ? "sk_live_…" : "FLWSECK-…"} error={state.errors?.secretKey} className="font-mono text-sm" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Public key" name="publicKey"><Input name="publicKey" autoComplete="off" spellCheck={false} className="font-mono text-sm" /></Field>
        {!paystack && (
          <Field label="Webhook secret hash" name="webhookHash" hint="Any long password you also type into Flutterwave → Settings → Webhooks.">
            <Input name="webhookHash" autoComplete="off" spellCheck={false} className="font-mono text-sm" />
          </Field>
        )}
      </div>
      <SubmitButton pending={pending} pendingText="Checking your key…">{connected ? "Update key" : `Connect ${paystack ? "Paystack" : "Flutterwave"}`}</SubmitButton>
    </form>
  );
}
