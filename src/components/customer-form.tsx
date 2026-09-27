"use client";

import { saveCustomer } from "@/app/actions/customers";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Textarea } from "./ui";

export function CustomerForm({ initial, next }: { initial?: { id: string; name: string; contactName: string; email: string; phone: string; address: string; tin: string; notes: string }; next?: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveCustomer, {});
  const e = state.errors ?? {};
  const v = { ...initial, ...state.values };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      {state.message && <Notice tone="danger">{state.message}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company or client name" name="name" required error={e.name}>
          <Input name="name" defaultValue={v.name} error={e.name} autoComplete="off" />
        </Field>
        <Field label="Contact person" name="contactName" hint="Shown as “Attn:” on invoices.">
          <Input name="contactName" defaultValue={v.contactName} autoComplete="off" />
        </Field>
        <Field label="Billing email" name="email" error={e.email} hint="Invoices and payment links go here. Often their accounts team.">
          <Input name="email" type="email" inputMode="email" defaultValue={v.email} error={e.email} />
        </Field>
        <Field label="Phone / WhatsApp" name="phone" error={e.phone}>
          <Input name="phone" type="tel" inputMode="tel" defaultValue={v.phone} error={e.phone} />
        </Field>
        <Field label="Address" name="address">
          <Input name="address" defaultValue={v.address} autoComplete="off" />
        </Field>
        <Field label="Client's TIN" name="tin" hint="Needed on VAT invoices to companies.">
          <Input name="tin" defaultValue={v.tin} autoComplete="off" />
        </Field>
      </div>
      <Field label="Private notes" name="notes" hint="Only you can see these.">
        <Textarea name="notes" defaultValue={v.notes} />
      </Field>
      <SubmitButton size="lg" pending={pending}>{initial ? "Save changes" : next === "invoice" ? "Save and create invoice" : "Save client"}</SubmitButton>
    </form>
  );
}
