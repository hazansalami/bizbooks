"use client";

import { useMemo, useState } from "react";
import { saveEmployee } from "@/app/actions/payroll";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Select } from "./ui";
import { BANKS, TAX } from "@/lib/constants";
import { naira, parseAmount } from "@/lib/money";
import { computePay, payeLine } from "@/lib/payroll";
import { cn } from "@/lib/utils";

export type EmployeeInitial = Record<string, string> & { id: string };

export function EmployeeForm({ initial, payeDefault = true, canEditBank = true }: { initial?: EmployeeInitial; payeDefault?: boolean; canEditBank?: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveEmployee, {});
  const e = state.errors ?? {};
  const v: Record<string, string> = { pension: "on", paye: payeDefault ? "on" : "", whtRate: "5", kind: "EMPLOYEE", ...initial, ...state.values };
  const [kind, setKind] = useState(v.kind);
  const [gross, setGross] = useState(v.monthlyGross ?? "");
  const [pension, setPension] = useState(v.pension === "on");
  const [nhf, setNhf] = useState(v.nhf === "on");
  const [paye, setPaye] = useState(v.paye === "on");
  const [rent, setRent] = useState(v.annualRent ?? "");
  const [wht, setWht] = useState(v.whtRate);
  const contractor = kind === "CONTRACTOR";
  const p = useMemo(() => computePay({ kind, monthlyGross: parseAmount(gross) || 0, pension, nhf, annualRent: parseAmount(rent) || 0, whtRate: Number(wht), paye }), [kind, gross, pension, nhf, rent, wht, paye]);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="space-y-5">
        {initial && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="kind" value={kind} />
        {state.message && <Notice tone="sun">{state.message}</Notice>}
        <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-semibold">How do you pay them?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[["EMPLOYEE", "Staff salary", "PAYE and pension"], ["CONTRACTOR", "Contractor / freelancer", "Withholding tax"]].map(([val, label, sub]) => (
                <button key={val} type="button" aria-pressed={kind === val} onClick={() => setKind(val)} className={cn("min-h-14 rounded-xl border px-3 py-2 text-left", kind === val ? "border-brand bg-brand-wash ring-2 ring-brand/30" : "border-line-strong")}>
                  <span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted">{sub}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" name="fullName" required error={e.fullName}><Input name="fullName" defaultValue={v.fullName} error={e.fullName} /></Field>
            <Field label={contractor ? "Role or service" : "Job title"} name="jobTitle"><Input name="jobTitle" defaultValue={v.jobTitle} placeholder={contractor ? "e.g. Motion designer" : "e.g. Account manager"} /></Field>
            <Field label={contractor ? "Monthly fee (₦)" : "Monthly gross pay (₦)"} name="monthlyGross" required error={e.monthlyGross} hint={contractor ? undefined : "Basic + housing + transport + other allowances, before deductions."}>
              <Input name="monthlyGross" inputMode="decimal" value={gross} onChange={(ev) => setGross(ev.target.value)} error={e.monthlyGross} className="num" />
            </Field>
            <Field label="Start date" name="startDate"><Input name="startDate" type="date" defaultValue={v.startDate} /></Field>
            <Field label="Email" name="email" error={e.email} hint="For payslips."><Input name="email" type="email" defaultValue={v.email} error={e.email} /></Field>
            <Field label="Phone" name="phone"><Input name="phone" type="tel" inputMode="tel" defaultValue={v.phone} /></Field>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
          <h2 className="text-lg">{contractor ? "Tax" : "Tax and deductions"}</h2>
          {contractor ? (
            <Field label="Withholding tax to deduct" name="whtRate" hint="You deduct this from each payment and remit it to the tax office. Consultancy and professional fees to Nigerian residents are 5%.">
              <Select name="whtRate" value={wht} onChange={(ev) => setWht(ev.target.value)}>
                {TAX.whtRates.map((w) => <option key={w.rate} value={w.rate}>{w.label}</option>)}
              </Select>
            </Field>
          ) : (
            <>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="paye" checked={paye} onChange={(ev) => setPaye(ev.target.checked)} className="mt-1 size-5 accent-brand" />
                <span><span className="font-semibold">Deduct PAYE (income tax)</span><span className="block text-sm text-muted">The company deducts it from their pay and remits it to the state tax office. Untick if they settle their own income tax.</span></span>
              </label>
              {!paye && (
                <Notice tone="sun">
                  Payslips will say they handle their own income tax. The law (Nigeria Tax Act 2025) still makes employers responsible for deducting and remitting PAYE on salaries, so if it goes unpaid the tax office can recover it from the company, with penalties. Check with your accountant.
                </Notice>
              )}
              <label className="flex items-start gap-3">
                <input type="checkbox" name="pension" checked={pension} onChange={(ev) => setPension(ev.target.checked)} className="mt-1 size-5 accent-brand" />
                <span><span className="font-semibold">Contributory pension</span><span className="block text-sm text-muted">8% from their pay, 10% from the company. Required for companies with 3 or more staff.</span></span>
              </label>
              {pension && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Pension fund administrator (PFA)" name="pfa"><Input name="pfa" defaultValue={v.pfa} placeholder="e.g. Stanbic IBTC Pension" /></Field>
                  <Field label="RSA PIN" name="pensionPin"><Input name="pensionPin" defaultValue={v.pensionPin} placeholder="PEN…" /></Field>
                </div>
              )}
              <label className="flex items-start gap-3">
                <input type="checkbox" name="nhf" checked={nhf} onChange={(ev) => setNhf(ev.target.checked)} className="mt-1 size-5 accent-brand" />
                <span><span className="font-semibold">National Housing Fund (2.5%)</span><span className="block text-sm text-muted">Only if they've registered for NHF.</span></span>
              </label>
              <Field label="Annual rent they pay (₦)" name="annualRent" error={e.annualRent} hint="Optional. 20% of it (up to ₦500,000 a year) is tax-free under the 2026 rules, if they give you proof.">
                <Input name="annualRent" inputMode="decimal" value={rent} onChange={(ev) => setRent(ev.target.value)} error={e.annualRent} className="num" />
              </Field>
            </>
          )}
        </section>

        <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
          <h2 className="text-lg">Where to pay them</h2>
          {!canEditBank && <p className="text-sm text-muted">Only the business owner can add or change bank details.</p>}
          <fieldset disabled={!canEditBank} className="grid gap-5 disabled:opacity-60 sm:grid-cols-3">
            <Field label="Bank" name="bankName"><Select name="bankName" defaultValue={v.bankName ?? ""}><option value="">Choose</option>{BANKS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Account number" name="accountNumber" error={e.accountNumber}><Input name="accountNumber" inputMode="numeric" maxLength={10} defaultValue={v.accountNumber} error={e.accountNumber} className="num" /></Field>
            <Field label="Account name" name="accountName"><Input name="accountName" defaultValue={v.accountName} /></Field>
          </fieldset>
        </section>
        <SubmitButton size="lg" pending={pending}>{initial ? "Save changes" : "Add to team"}</SubmitButton>
      </div>

      <aside className="rounded-2xl border border-line bg-paper p-5 lg:sticky lg:top-6" aria-live="polite">
        <h2 className="text-base">Each month</h2>
        <dl className="num mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><dt>{contractor ? "Fee" : "Gross pay"}</dt><dd className="font-semibold">{naira(p.gross)}</dd></div>
          {!contractor && <div className="flex justify-between text-ink-soft"><dt>Pension (8%)</dt><dd>−{naira(p.pensionEmployee)}</dd></div>}
          {p.nhf > 0 && <div className="flex justify-between text-ink-soft"><dt>NHF</dt><dd>−{naira(p.nhf)}</dd></div>}
          {!contractor && <div className="flex justify-between gap-3 text-ink-soft"><dt>PAYE tax</dt><dd className="text-right">{payeLine(p, naira)}</dd></div>}
          {contractor && <div className="flex justify-between text-ink-soft"><dt>WHT ({wht}%)</dt><dd>−{naira(p.wht)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Take-home</dt><dd>{naira(p.net)}</dd></div>
          {!contractor && <div className="flex justify-between pt-2 text-muted"><dt>Company pension (10%)</dt><dd>{naira(p.pensionEmployer)}</dd></div>}
          <div className="flex justify-between text-muted"><dt>Total cost to company</dt><dd>{naira(p.gross + p.pensionEmployer)}</dd></div>
        </dl>
      </aside>
    </form>
  );
}
