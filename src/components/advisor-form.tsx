"use client";

import { CheckCircle2 } from "lucide-react";
import { requestAdvisor } from "@/app/actions/advisors";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Select, Textarea } from "./ui";
import { ADVISOR_SERVICES } from "@/lib/advisors";
import { TEAM_SIZES } from "@/lib/constants";

export function AdvisorForm({ defaults, source = "WEBSITE" }: { defaults?: Partial<Record<"companyName" | "contactName" | "email" | "phone" | "teamSize", string>>; source?: "WEBSITE" | "APP" }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(requestAdvisor, {});
  const e = state.errors ?? {};
  const v: Record<string, string | undefined> = { ...defaults, ...state.values };
  const chosen = (v.services ?? "").split(",");
  if (state.ok) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-brand-wash p-5 text-brand-deep">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden />
        <p className="font-medium">{state.message}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="source" value={source} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.message && <Notice tone="danger">{state.message}</Notice>}
      <fieldset>
        <legend className="text-sm font-semibold">What do you need help with?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ADVISOR_SERVICES.map((s) => (
            <label key={s.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-3 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-wash">
              <input type="checkbox" name="services" value={s.key} defaultChecked={chosen.includes(s.key)} className="size-4 accent-brand" />{s.name}
            </label>
          ))}
        </div>
        {e.services && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.services}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" name="companyName" required error={e.companyName}><Input name="companyName" defaultValue={v.companyName} error={e.companyName} autoComplete="organization" /></Field>
        <Field label="Your name" name="contactName" required error={e.contactName}><Input name="contactName" defaultValue={v.contactName} error={e.contactName} autoComplete="name" /></Field>
        <Field label="Email" name="email" required error={e.email}><Input name="email" type="email" defaultValue={v.email} error={e.email} autoComplete="email" /></Field>
        <Field label="Phone / WhatsApp" name="phone"><Input name="phone" type="tel" inputMode="tel" defaultValue={v.phone} autoComplete="tel" /></Field>
        <Field label="Team size" name="teamSize">
          <Select name="teamSize" defaultValue={v.teamSize ?? ""}><option value="">Choose</option>{TEAM_SIZES.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
      </div>
      <Field label="Anything we should know?" name="message" hint="e.g. two years of books to catch up, a VAT audit, or a funding round coming up.">
        <Textarea name="message" defaultValue={v.message} />
      </Field>
      <SubmitButton size="lg" pending={pending} pendingText="Sending…">Book a free consultation</SubmitButton>
      <p className="text-xs text-muted">By sending this you agree to our <a href="/privacy" className="underline">Privacy Policy</a>. A consultation is general information until an engagement letter is signed (see our <a href="/terms" className="underline">Terms</a>).</p>
    </form>
  );
}
