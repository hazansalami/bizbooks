"use client";

import { useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { computePay } from "@/lib/payroll";
import { companyTax, employerCost, grossUp, vatSplit } from "@/lib/calc";
import { computeTotals, naira, parseAmount } from "@/lib/money";
import { TAX } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { emailResults } from "@/app/actions/leads";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { inputClass } from "./ui";

/* ---------- shared bits ---------- */

function Money({ label, value, onChange, hint, id }: { label: string; value: string; onChange: (v: string) => void; hint?: string; id: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="relative mt-1.5 block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">₦</span>
        <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "num pl-8 text-lg")} />
      </span>
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 accent-brand" />
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
    </label>
  );
}

function Toggle<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div className="flex gap-1 rounded-full bg-canvas p-1 text-sm font-semibold" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("min-h-10 flex-1 rounded-full px-3", value === v ? "bg-paper shadow-sm" : "text-muted")}>{l}</button>
      ))}
    </div>
  );
}

type Line = [string, string];

function Breakdown({ lines, total }: { lines: Line[]; total?: Line }) {
  return (
    <dl className="num mt-5 space-y-2 text-sm">
      {lines.map(([k, v]) => <div key={k} className="flex justify-between gap-4 text-ink-soft"><dt>{k}</dt><dd className="text-right">{v}</dd></div>)}
      {total && <div className="flex justify-between gap-4 border-t border-line pt-2 font-bold text-ink"><dt>{total[0]}</dt><dd>{total[1]}</dd></div>}
    </dl>
  );
}

/** Optional lead capture: never blocks the result, just offers to send it plus a related guide. */
function EmailResults({ tool, lines, inputs }: { tool: string; lines: Line[]; inputs: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(emailResults, {});
  if (state.ok) return <p className="mt-5 rounded-xl bg-brand-wash p-3 text-sm font-medium text-brand-deep" role="status">{state.message}</p>;
  return (
    <form onSubmit={onSubmit} className="mt-5 rounded-xl border border-line bg-paper p-3" noValidate>
      <input type="hidden" name="tool" value={tool} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="inputs" value={inputs} />
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label htmlFor={`email-${tool}`} className="flex items-center gap-2 text-sm font-semibold"><Mail className="size-4 text-brand" aria-hidden />Email me this breakdown</label>
      <div className="mt-2 flex gap-2">
        <input id={`email-${tool}`} name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com" defaultValue={state.values?.email}
          aria-invalid={state.errors?.email ? true : undefined} className={cn(inputClass, "min-h-11 flex-1 text-sm")} />
        <SubmitButton size="sm" pending={pending} pendingText="Sending…" className="min-h-11">Send</SubmitButton>
      </div>
      {(state.errors?.email || state.message) && <p role="alert" className="mt-1.5 text-sm text-danger">{state.errors?.email ?? state.message}</p>}
      <p className="mt-1.5 text-xs text-muted">Plus a free guide to go with it. No spam, and we never share your email. See our <a href="/privacy" className="underline">Privacy Policy</a>.</p>
    </form>
  );
}

function Shell({ inputs, result }: { inputs: React.ReactNode; result: React.ReactNode }) {
  return (
    <div className="grid gap-6 rounded-3xl border border-line bg-paper p-5 shadow-sm sm:p-8 lg:grid-cols-2">
      <div className="space-y-5">{inputs}</div>
      <div className="rounded-2xl bg-canvas p-5" aria-live="polite">{result}</div>
    </div>
  );
}

const n = (v: number) => naira(Math.round(v));

/* ---------- PAYE ---------- */

export function PayeCalculator() {
  const [gross, setGross] = useState("500,000");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [rent, setRent] = useState("");
  const [pension, setPension] = useState(true);
  const [nhf, setNhf] = useState(false);
  const monthly = (parseAmount(gross) || 0) / (period === "year" ? 12 : 1);
  const p = useMemo(() => computePay({ kind: "EMPLOYEE", monthlyGross: monthly, pension, nhf, annualRent: parseAmount(rent) || 0, whtRate: 0 }), [monthly, pension, nhf, rent]);
  const annualTaxable = Math.max(0, monthly * 12 - (p.pensionEmployee + p.nhf) * 12 - p.rentRelief * 12);
  const effective = monthly > 0 ? (p.paye / monthly) * 100 : 0;
  const lines: Line[] = [["Gross monthly pay", n(p.gross)], ["Pension (8%)", `−${n(p.pensionEmployee)}`], ...(nhf ? [["NHF (2.5%)", `−${n(p.nhf)}`] as Line] : []), ["Monthly PAYE", `−${n(p.paye)}`], ["Annual PAYE", n(p.paye * 12)], ["Effective tax rate", `${effective.toFixed(1)}%`], ["Monthly take-home", n(p.net)]];

  return (
    <Shell
      inputs={<>
        <Toggle label="Salary period" value={period} onChange={setPeriod} options={[["month", "Monthly salary"], ["year", "Annual salary"]]} />
        <Money id="gross" label={period === "month" ? "Gross monthly pay" : "Gross annual pay"} value={gross} onChange={setGross} hint="Basic + housing + transport + other allowances, before deductions." />
        <Money id="rent" label="Annual rent paid (for rent relief)" value={rent} onChange={setRent} hint="Optional. 20% of rent, up to ₦500,000 a year, is tax-free." />
        <Check label="Contributory pension (8%)" checked={pension} onChange={setPension} />
        <Check label="National Housing Fund (2.5%)" checked={nhf} onChange={setNhf} />
      </>}
      result={<>
        <p className="text-sm font-semibold text-muted">Monthly take-home pay</p>
        <p className="num text-4xl font-bold tracking-tight">{n(p.net)}</p>
        <Breakdown lines={[["Gross pay", n(p.gross)], ...(pension ? [["Pension (8%)", `−${n(p.pensionEmployee)}`] as Line] : []), ...(nhf ? [["NHF (2.5%)", `−${n(p.nhf)}`] as Line] : []), ["PAYE tax", `−${n(p.paye)}`]]} total={["Take-home", n(p.net)]} />
        <dl className="num mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Annual PAYE</dt><dd className="font-bold">{n(p.paye * 12)}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Effective tax rate</dt><dd className="font-bold">{effective.toFixed(1)}%</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Annual taxable income</dt><dd className="font-bold">{n(annualTaxable)}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Employer pension (10%)</dt><dd className="font-bold">{n(p.pensionEmployer)}</dd></div>
        </dl>
        <EmailResults tool="paye-calculator" lines={lines} inputs={`${n(monthly)} a month${parseAmount(rent) ? `, ${n(parseAmount(rent))} annual rent` : ""}`} />
      </>}
    />
  );
}

/* ---------- Net to gross ---------- */

export function NetToGrossCalculator() {
  const [net, setNet] = useState("350,000");
  const [rent, setRent] = useState("");
  const [pension, setPension] = useState(true);
  const [nhf, setNhf] = useState(false);
  const p = useMemo(() => grossUp(parseAmount(net) || 0, { pension, nhf, annualRent: parseAmount(rent) || 0 }), [net, pension, nhf, rent]);
  const lines: Line[] = [["Target take-home", n(parseAmount(net) || 0)], ["Gross monthly salary", n(p.gross)], ["Pension (8%)", n(p.pensionEmployee)], ["PAYE", n(p.paye)], ["Employer pension (10%)", n(p.pensionEmployer)], ["Annual gross", n(p.gross * 12)]];
  return (
    <Shell
      inputs={<>
        <Money id="net" label="Take-home pay you want to offer (monthly)" value={net} onChange={setNet} hint="The amount the employee should receive after tax and pension." />
        <Money id="rent2" label="Employee's annual rent (for rent relief)" value={rent} onChange={setRent} hint="Optional. Lowers PAYE, so the gross can be lower." />
        <Check label="Contributory pension (8%)" checked={pension} onChange={setPension} />
        <Check label="National Housing Fund (2.5%)" checked={nhf} onChange={setNhf} />
      </>}
      result={<>
        <p className="text-sm font-semibold text-muted">Gross monthly salary to offer</p>
        <p className="num text-4xl font-bold tracking-tight">{n(p.gross)}</p>
        <p className="num mt-1 text-sm text-muted">{n(p.gross * 12)} a year</p>
        <Breakdown lines={[["Gross salary", n(p.gross)], ...(pension ? [["Pension (8%)", `−${n(p.pensionEmployee)}`] as Line] : []), ...(nhf ? [["NHF", `−${n(p.nhf)}`] as Line] : []), ["PAYE", `−${n(p.paye)}`]]} total={["Take-home", n(p.net)]} />
        {pension && <p className="mt-4 rounded-xl bg-paper p-3 text-sm">The company also pays <strong className="num">{n(p.pensionEmployer)}</strong> employer pension each month.</p>}
        <EmailResults tool="net-to-gross-salary-calculator" lines={lines} inputs={`${n(parseAmount(net) || 0)} take-home a month`} />
      </>}
    />
  );
}

/* ---------- Employer cost ---------- */

export function EmployerCostCalculator() {
  const [gross, setGross] = useState("400,000");
  const [staff, setStaff] = useState("6");
  const [big, setBig] = useState(false);
  const c = useMemo(() => employerCost({ monthlyGross: parseAmount(gross) || 0, staff: Number(staff) || 1, bigTurnover: big, annualRent: 0 }), [gross, staff, big]);
  const lines: Line[] = [["Gross salary", n(parseAmount(gross) || 0)], ["Employer pension (10%)", n(c.pensionEmployer)], ["NSITF (1%)", n(c.nsitf)], ["ITF (1%)", n(c.itf)], ["Monthly cost to company", n(c.monthly)], ["Annual cost to company", n(c.annual)], ["Employee take-home", n(c.pay.net)]];
  return (
    <Shell
      inputs={<>
        <Money id="ec-gross" label="Gross monthly salary" value={gross} onChange={setGross} />
        <label htmlFor="staff" className="block">
          <span className="text-sm font-semibold">How many employees do you have (including this hire)?</span>
          <input id="staff" inputMode="numeric" value={staff} onChange={(e) => setStaff(e.target.value.replace(/\D/g, ""))} className={cn(inputClass, "num mt-1.5 text-lg")} />
          <span className="mt-1 block text-sm text-muted">Pension applies from 3 employees, ITF from 5.</span>
        </label>
        <Check label="Annual turnover is ₦50 million or more" checked={big} onChange={setBig} hint="ITF also applies above this turnover, whatever the headcount." />
      </>}
      result={<>
        <p className="text-sm font-semibold text-muted">Real monthly cost of this employee</p>
        <p className="num text-4xl font-bold tracking-tight">{n(c.monthly)}</p>
        <p className="num mt-1 text-sm text-muted">{n(c.annual)} a year · {n(c.onTop)} a month on top of salary</p>
        <Breakdown lines={[["Gross salary", n(parseAmount(gross) || 0)], ["Employer pension (10%)", c.pensionApplies ? n(c.pensionEmployer) : "Not required (under 3 staff)"], ["NSITF (1%)", n(c.nsitf)], ["ITF (1%)", c.itfApplies ? n(c.itf) : "Not required"]]} total={["Total monthly cost", n(c.monthly)]} />
        <p className="mt-4 rounded-xl bg-paper p-3 text-sm">The employee takes home about <strong className="num">{n(c.pay.net)}</strong> after PAYE{c.pensionApplies ? " and pension" : ""}.</p>
        <EmailResults tool="employer-cost-calculator" lines={lines} inputs={`${n(parseAmount(gross) || 0)} salary, ${staff} employees`} />
      </>}
    />
  );
}

/* ---------- Company income tax ---------- */

export function CompanyTaxCalculator() {
  const [turnover, setTurnover] = useState("150,000,000");
  const [assets, setAssets] = useState("20,000,000");
  const [profit, setProfit] = useState("30,000,000");
  const [assessable, setAssessable] = useState("");
  const [prof, setProf] = useState(false);
  const r = useMemo(() => companyTax({
    turnover: parseAmount(turnover) || 0, fixedAssets: parseAmount(assets) || 0, professional: prof,
    taxableProfit: parseAmount(profit) || 0, assessableProfit: parseAmount(assessable) || parseAmount(profit) || 0,
  }), [turnover, assets, profit, assessable, prof]);
  const lines: Line[] = [["Small company?", r.small ? "Yes, 0% CIT" : "No"], ["Company income tax (30%)", n(r.cit)], ["Development levy (4%)", n(r.levy)], ["Total", n(r.total)], ["Effective rate on profit", `${r.effective.toFixed(1)}%`]];
  return (
    <Shell
      inputs={<>
        <Money id="turnover" label="Annual turnover (sales before VAT)" value={turnover} onChange={setTurnover} />
        <Money id="assets" label="Total fixed assets (at cost)" value={assets} onChange={setAssets} hint="Equipment, vehicles, property, fit-out." />
        <Money id="profit" label="Taxable profit" value={profit} onChange={setProfit} hint="Profit after allowable expenses and capital allowances. Ask your accountant if unsure." />
        <Money id="assessable" label="Assessable profit (optional)" value={assessable} onChange={setAssessable} hint="Profit before capital allowances and losses. The development levy uses this. Leave empty to use taxable profit." />
        <Check label="We provide professional services" checked={prof} onChange={setProf} hint="Consulting, legal, accounting, engineering, architecture and similar." />
      </>}
      result={<>
        <p className={cn("inline-flex rounded-full px-3 py-1 text-sm font-bold", r.small ? "bg-brand text-white" : "bg-sun text-ink")}>{r.small ? "Small company: 0% company tax" : "Not a small company"}</p>
        {!r.small && <p className="mt-2 text-sm text-ink-soft">Because {r.reasons.join(", and ")}.</p>}
        <p className="mt-4 text-sm font-semibold text-muted">Estimated tax for the year</p>
        <p className="num text-4xl font-bold tracking-tight">{n(r.total)}</p>
        <Breakdown lines={[["Company income tax (30% of taxable profit)", n(r.cit)], ["Development levy (4% of assessable profit)", n(r.levy)]]} total={["Total", n(r.total)]} />
        <p className="mt-4 rounded-xl bg-paper p-3 text-sm">
          {r.small ? "You still file an annual return within 6 months of your year end, even at 0%." : `That's about ${r.effective.toFixed(1)}% of taxable profit. The return and payment are due within 6 months of your year end.`}
          {r.large && " Very large companies (₦50bn+ turnover) may also be subject to a 15% minimum effective tax rate."}
        </p>
        <EmailResults tool="company-income-tax-calculator" lines={lines} inputs={`turnover ${n(parseAmount(turnover) || 0)}, taxable profit ${n(parseAmount(profit) || 0)}${prof ? ", professional services" : ""}`} />
      </>}
    />
  );
}

/* ---------- VAT add / remove ---------- */

export function VatCalculator() {
  const [amount, setAmount] = useState("1,000,000");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const v = vatSplit(parseAmount(amount) || 0, mode);
  const lines: Line[] = [["Amount before VAT", n(v.net)], ["VAT (7.5%)", n(v.vat)], ["Total including VAT", n(v.gross)]];
  return (
    <Shell
      inputs={<>
        <Toggle label="Calculation" value={mode} onChange={setMode} options={[["add", "Add VAT to a price"], ["remove", "Remove VAT from a total"]]} />
        <Money id="vat-amount" label={mode === "add" ? "Price before VAT" : "Total including VAT"} value={amount} onChange={setAmount} />
        <p className="rounded-xl bg-canvas p-3 text-sm text-ink-soft">
          {mode === "add" ? "Multiply by 1.075 to get the VAT-inclusive total." : "Divide by 1.075 to get the amount before VAT. VAT is the difference."}
        </p>
      </>}
      result={<>
        <p className="text-sm font-semibold text-muted">{mode === "add" ? "Total including VAT" : "Amount before VAT"}</p>
        <p className="num text-4xl font-bold tracking-tight">{naira(mode === "add" ? v.gross : v.net)}</p>
        <Breakdown lines={[["Amount before VAT", naira(v.net)], ["VAT (7.5%)", naira(v.vat)]]} total={["Total including VAT", naira(v.gross)]} />
        <EmailResults tool="vat-calculator" lines={lines} inputs={`${mode === "add" ? "added VAT to" : "removed VAT from"} ${naira(parseAmount(amount) || 0)}`} />
      </>}
    />
  );
}

/* ---------- VAT + WHT on an invoice ---------- */

export function VatWhtCalculator() {
  const [amount, setAmount] = useState("1,000,000");
  const [vat, setVat] = useState(true);
  const [wht, setWht] = useState("5");
  const t = useMemo(() => computeTotals([{ description: "x", quantity: 1, unitPrice: parseAmount(amount) || 0 }], 0, vat ? TAX.vatRate : 0, Number(wht)), [amount, vat, wht]);
  const lines: Line[] = [["Amount before VAT", naira(t.subtotal)], ["VAT (7.5%)", naira(t.vatAmount)], ["Invoice total", naira(t.total)], [`WHT deducted (${wht}%)`, naira(t.whtAmount)], ["Amount payable", naira(t.amountDue)]];
  return (
    <Shell
      inputs={<>
        <Money id="amount" label="Invoice amount before VAT" value={amount} onChange={setAmount} />
        <Check label="Add VAT at 7.5%" checked={vat} onChange={setVat} />
        <fieldset>
          <legend className="text-sm font-semibold">Withholding tax the client deducts</legend>
          <div className="mt-2 space-y-2">
            {TAX.whtRates.map((w) => (
              <label key={w.rate} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm", String(w.rate) === wht ? "border-brand bg-brand-wash" : "border-line")}>
                <input type="radio" name="wht" value={w.rate} checked={String(w.rate) === wht} onChange={() => setWht(String(w.rate))} className="accent-brand" />{w.label}
              </label>
            ))}
          </div>
        </fieldset>
      </>}
      result={<>
        <p className="text-sm font-semibold text-muted">Your client pays you</p>
        <p className="num text-4xl font-bold tracking-tight">{naira(t.amountDue)}</p>
        <Breakdown lines={[["Amount before VAT", naira(t.subtotal)], ...(vat ? [["VAT (7.5%)", `+${naira(t.vatAmount)}`] as Line] : []), ["Invoice total", naira(t.total)], ...(Number(wht) > 0 ? [[`Less WHT (${wht}% of amount before VAT)`, `−${naira(t.whtAmount)}`] as Line] : [])]} total={["Amount payable", naira(t.amountDue)]} />
        <div className="mt-5 space-y-1 rounded-xl bg-paper p-3 text-sm">
          {vat && <p><strong>{naira(t.vatAmount)}</strong> VAT is due to the NRS by the 21st of next month.</p>}
          {Number(wht) > 0 && <p><strong>{naira(t.whtAmount)}</strong> WHT is a tax credit for you. Ask the client for the credit note.</p>}
        </div>
        <EmailResults tool="vat-wht-calculator" lines={lines} inputs={`${naira(parseAmount(amount) || 0)} invoice, ${wht}% WHT`} />
      </>}
    />
  );
}
