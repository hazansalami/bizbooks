"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, ImagePlus, Lock } from "lucide-react";
import { saveBankStep, saveBrandStep, saveBusinessStep, savePaymentsStep, saveTaxStep } from "@/app/actions/onboarding";
import { SubmitButton, useFormAction, type FormState } from "@/components/form-bits";
import { buttonClass, Field, Input, Notice, Select } from "@/components/ui";
import { BANKS, ENTITY_TYPES, INDUSTRIES, NIGERIAN_STATES, TEAM_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { STEPS, type Step } from "@/lib/onboarding-steps";

function StepHeader({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{body}</p>
    </div>
  );
}

function Actions({ back, pending, primary, skip }: { back?: Step; pending: boolean; primary: string; skip?: string }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {back ? (
        <Link href={`/onboarding?step=${back}`} className={buttonClass("ghost", "md")}>← Back</Link>
      ) : <span />}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {skip && (
          <button type="submit" name="intent" value="skip" formNoValidate className={buttonClass("secondary", "lg")}>
            {skip}
          </button>
        )}
        <SubmitButton size="lg" pending={pending} pendingText="Saving…">{primary}</SubmitButton>
      </div>
    </div>
  );
}

export function BusinessStep({ greeting, defaults }: { greeting?: string; defaults: Record<string, string> }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveBusinessStep, {});
  const e = state.errors ?? {};
  const v = { ...defaults, ...state.values };
  const [industry, setIndustry] = useState(v.industry);
  const [teamSize, setTeamSize] = useState(v.teamSize);
  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeader
        title={greeting ? `${greeting} Let's set up your company.` : "Your company"}
        body="These details appear on your invoices and payslips, and tell us which taxes apply to you."
      />
      <div className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" name="name" required error={e.name} hint="The name clients know you by.">
            <Input name="name" defaultValue={v.name} required error={e.name} autoComplete="organization" />
          </Field>
          <Field label="Registered as" name="entityType" required error={e.entityType}>
            <Select name="entityType" defaultValue={v.entityType || "LTD"} error={e.entityType}>
              {Object.entries(ENTITY_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
          <Field label="CAC number (RC or BN)" name="rcNumber" hint="Shown on invoices. Corporate clients often check it.">
            <Input name="rcNumber" defaultValue={v.rcNumber} autoComplete="off" placeholder="e.g. 1234567" />
          </Field>
          <fieldset>
            <legend className="text-sm font-semibold">Team size</legend>
            <input type="hidden" name="teamSize" value={teamSize} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TEAM_SIZES.map((t) => (
                <button key={t} type="button" aria-pressed={teamSize === t} onClick={() => setTeamSize(t)}
                  className={cn("min-h-10 rounded-full border px-3 text-sm font-medium", teamSize === t ? "border-brand bg-brand text-white" : "border-line-strong hover:border-ink")}>{t}</button>
              ))}
            </div>
          </fieldset>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">What do you do?</legend>
          <input type="hidden" name="industry" value={industry} />
          <div className="mt-2 flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={industry === i}
                onClick={() => setIndustry(i)}
                className={cn(
                  "min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  industry === i ? "border-brand bg-brand text-white" : "border-line-strong bg-paper hover:border-ink",
                )}
              >
                {i}
              </button>
            ))}
          </div>
          {e.industry && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.industry}</p>}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company phone" name="phone" error={e.phone} hint="Shown on invoices.">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} placeholder="0803 123 4567" />
          </Field>
          <Field label="Accounts email" name="email" error={e.email} hint="Client replies and payment alerts come here.">
            <Input name="email" type="email" inputMode="email" defaultValue={v.email} error={e.email} />
          </Field>
          <Field label="State" name="state">
            <Select name="state" defaultValue={v.state}>
              <option value="">Choose a state</option>
              {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="City or area" name="city">
            <Input name="city" defaultValue={v.city} autoComplete="address-level2" placeholder="e.g. Victoria Island" />
          </Field>
        </div>
      </div>
      <Actions pending={pending} primary="Continue" />
    </form>
  );
}

export function BankStep() {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveBankStep, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeader
        title="Which account should clients pay into?"
        body="Printed on every invoice with a copy button, so clients' accounts teams can pay by transfer without emailing you for details."
      />
      <div className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <Field label="Bank" name="bankName" required error={e.bankName}>
          <Select name="bankName" defaultValue={v.bankName ?? ""} required error={e.bankName}>
            <option value="" disabled>Choose your bank</option>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Account number" name="accountNumber" required error={e.accountNumber} hint="10 digits">
          <Input name="accountNumber" inputMode="numeric" maxLength={10} pattern="\d{10}" autoComplete="off" defaultValue={v.accountNumber} required error={e.accountNumber} className="num tracking-wider" />
        </Field>
        <Field label="Account name" name="accountName" required error={e.accountName} hint="Exactly as your bank shows it, so clients' finance teams can verify it.">
          <Input name="accountName" defaultValue={v.accountName} required error={e.accountName} />
        </Field>
      </div>
      <Actions back="business" pending={pending} primary="Save and continue" skip="I'll add it later" />
    </form>
  );
}

export function PaymentsStep() {
  const { state, onSubmit, pending } = useFormAction<FormState>(savePaymentsStep, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const [provider, setProvider] = useState(v.provider ?? "PAYSTACK");
  const paystack = provider === "PAYSTACK";
  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeader
        title="Get paid online, straight to your account"
        body="Connect your company's own Paystack or Flutterwave account and every invoice gets a secure “Pay now” link for card, transfer and USSD."
      />
      <Notice tone="brand" className="mb-5">
        Money goes straight from your client to your Paystack or Flutterwave account, then to your bank. BizBooks never touches it.
      </Notice>
      <div className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <fieldset>
          <legend className="text-sm font-semibold">Which one do you use?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[["PAYSTACK", "Paystack"], ["FLUTTERWAVE", "Flutterwave"]].map(([val, label]) => (
              <label key={val} className={cn("flex min-h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold", provider === val ? "border-brand bg-brand-wash text-brand-deep ring-2 ring-brand/30" : "border-line-strong")}>
                <input type="radio" name="provider" value={val} checked={provider === val} onChange={() => setProvider(val)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <details className="rounded-xl bg-canvas p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Where do I find my keys?</summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-soft">
            {paystack ? (
              <>
                <li>Log in to your Paystack dashboard.</li>
                <li>Go to <strong>Settings → API Keys &amp; Webhooks</strong>.</li>
                <li>Copy the <strong>Live Secret Key</strong> (it starts with <code>sk_live_</code>).</li>
              </>
            ) : (
              <>
                <li>Log in to your Flutterwave dashboard.</li>
                <li>Go to <strong>Settings → API Keys</strong>.</li>
                <li>Copy the <strong>Secret Key</strong> (it starts with <code>FLWSECK-</code>).</li>
              </>
            )}
            <li>Paste it below. We check it straight away.</li>
          </ol>
          <a href={paystack ? "https://dashboard.paystack.com/#/settings/developers" : "https://app.flutterwave.com/dashboard/settings/apis/live"} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            Open {paystack ? "Paystack" : "Flutterwave"} dashboard <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <p className="mt-3 text-muted">No account yet? Opening one is free on both sites. Skip this step and come back when you're approved.</p>
        </details>

        <Field label="Secret key" name="secretKey" required error={e.secretKey} hint={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden /> Encrypted and never shown in full again.</span>}>
          <Input name="secretKey" autoComplete="off" spellCheck={false} placeholder={paystack ? "sk_live_…" : "FLWSECK-…"} error={e.secretKey} className="font-mono text-sm" />
        </Field>
        <Field label="Public key" name="publicKey" hint="Optional. Useful later for in-page checkout.">
          <Input name="publicKey" autoComplete="off" spellCheck={false} defaultValue={v.publicKey} placeholder={paystack ? "pk_live_…" : "FLWPUBK-…"} className="font-mono text-sm" />
        </Field>
      </div>
      <Actions back="bank" pending={pending} primary="Check and connect" skip="I'll do this later" />
    </form>
  );
}

export function TaxStep({ defaults }: { defaults: { vatRegistered: boolean; tin: string; paymentTermsDays: number; professionalServices: boolean } }) {
  const { onSubmit, pending } = useFormAction<FormState>(saveTaxStep, {});
  const [vat, setVat] = useState(defaults.vatRegistered ? "yes" : "no");
  const [prof, setProf] = useState(defaults.professionalServices ? "yes" : "no");
  const [terms, setTerms] = useState(String(defaults.paymentTermsDays));
  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeader title="Tax and payment terms" body="So we track the right taxes and warn you before deadlines. Not sure? The defaults are fine, and you can change them later." />
      <div className="space-y-6 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <fieldset>
          <legend className="text-sm font-semibold">Do you charge VAT (7.5%) on your sales?</legend>
          <p className="mt-1 text-sm text-muted">Choose “Yes” if you're registered and add VAT to your invoices. Most companies billing corporate clients are.</p>
          <input type="hidden" name="vatRegistered" value={vat} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[["no", "No"], ["yes", "Yes, I'm VAT registered"]].map(([val, label]) => (
              <button key={val} type="button" aria-pressed={vat === val} onClick={() => setVat(val)} className={cn("min-h-12 rounded-xl border px-3 text-sm font-semibold", vat === val ? "border-brand bg-brand-wash text-brand-deep ring-2 ring-brand/30" : "border-line-strong")}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">Do you provide professional services?</legend>
          <p className="mt-1 text-sm text-muted">Consulting, legal, accounting, engineering, architecture and similar. It decides whether the small-company tax exemption can apply.</p>
          <input type="hidden" name="professionalServices" value={prof} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[["no", "No"], ["yes", "Yes"]].map(([val, label]) => (
              <button key={val} type="button" aria-pressed={prof === val} onClick={() => setProf(val)} className={cn("min-h-12 rounded-xl border px-3 text-sm font-semibold", prof === val ? "border-brand bg-brand-wash text-brand-deep ring-2 ring-brand/30" : "border-line-strong")}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Company TIN" name="tin" hint="Shown on invoices. Corporate clients need it to process your invoice and issue WHT credit notes.">
          <Input name="tin" defaultValue={defaults.tin} inputMode="numeric" autoComplete="off" />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">Your usual payment terms</legend>
          <input type="hidden" name="paymentTermsDays" value={terms} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["0", "Immediately"], ["7", "Within 7 days"], ["14", "Within 14 days"], ["30", "Within 30 days"]].map(([val, label]) => (
              <button key={val} type="button" aria-pressed={terms === val} onClick={() => setTerms(val)} className={cn("min-h-12 rounded-xl border px-2 text-sm font-semibold", terms === val ? "border-brand bg-brand-wash text-brand-deep ring-2 ring-brand/30" : "border-line-strong")}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">This sets the default due date. You can change it on any invoice.</p>
        </fieldset>
      </div>
      <Actions back="payments" pending={pending} primary="Continue" />
    </form>
  );
}

/** Shrinks the logo in the browser so a 3 MB phone photo becomes a ~30 KB PNG before upload. */
async function resizeLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 320;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoPicker({ defaultLogo, error }: { defaultLogo: string; error?: string }) {
  const [logo, setLogo] = useState(defaultLogo);
  return (
    <div>
      <input type="hidden" name="logo" value={logo} />
      <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-line-strong p-4 hover:border-ink">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="Your logo" className="size-full object-contain" /> : <ImagePlus className="size-6 text-muted" aria-hidden />}
        </span>
        <span className="text-sm">
          <span className="font-semibold">{logo ? "Change logo" : "Upload your logo"}</span>
          <span className="block text-muted">PNG or JPG. We'll resize it for you.</span>
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            if (f) setLogo(await resizeLogo(f));
          }}
        />
      </label>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

const SWATCHES = ["#0E7A55", "#1D4F91", "#7A2E8E", "#B42318", "#C2410C", "#14201B"];

export function ColorPicker({ defaultColor }: { defaultColor: string }) {
  const [color, setColor] = useState(defaultColor);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="brandColor" value={color} />
      {SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Use colour ${c}`} aria-pressed={color === c} className={cn("size-10 rounded-full ring-offset-2", color === c && "ring-2 ring-ink")} style={{ background: c }} />
      ))}
      <label className="ml-1 inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong px-3 text-sm">
        Custom
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
      </label>
    </div>
  );
}

export function BrandStep({ businessName, defaults }: { businessName: string; defaults: { logo: string; brandColor: string } }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveBrandStep, {});
  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeader title="Your brand" body={`Add ${businessName ? `${businessName}'s` : "your"} logo for invoices, quotes and payslips.`} />
      <div className="space-y-6 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <LogoPicker defaultLogo={defaults.logo} error={state.errors?.logo} />
        <div>
          <p className="text-sm font-semibold">Brand colour</p>
          <p className="mb-3 text-sm text-muted">Used on your invoice headings and Pro emails.</p>
          <ColorPicker defaultColor={defaults.brandColor} />
        </div>
      </div>
      <Actions back={STEPS[3]} pending={pending} primary="Finish setup" skip="Skip for now" />
    </form>
  );
}
