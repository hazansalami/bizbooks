"use client";

import { useMemo, useState } from "react";
import { computePay } from "@/lib/payroll";
import { computeTotals, naira, parseAmount } from "@/lib/money";
import { TAX } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { inputClass } from "./ui";

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

  return (
    <div className="grid gap-6 rounded-3xl border border-line bg-paper p-5 shadow-sm sm:p-8 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="flex gap-1 rounded-full bg-canvas p-1 text-sm font-semibold" role="radiogroup" aria-label="Salary period">
          {(["month", "year"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={period === v} onClick={() => setPeriod(v)} className={cn("min-h-10 flex-1 rounded-full", period === v ? "bg-paper shadow-sm" : "text-muted")}>
              {v === "month" ? "Monthly salary" : "Annual salary"}
            </button>
          ))}
        </div>
        <Money id="gross" label={period === "month" ? "Gross monthly pay" : "Gross annual pay"} value={gross} onChange={setGross} hint="Basic + housing + transport + other allowances, before deductions." />
        <Money id="rent" label="Annual rent paid (for rent relief)" value={rent} onChange={setRent} hint="Optional. 20% of rent, up to ₦500,000 a year, is tax-free." />
        <label className="flex items-center gap-3"><input type="checkbox" checked={pension} onChange={(e) => setPension(e.target.checked)} className="size-5 accent-brand" /> Contributory pension (8%)</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={nhf} onChange={(e) => setNhf(e.target.checked)} className="size-5 accent-brand" /> National Housing Fund (2.5%)</label>
      </div>

      <div className="rounded-2xl bg-canvas p-5" aria-live="polite">
        <p className="text-sm font-semibold text-muted">Monthly take-home pay</p>
        <p className="num text-4xl font-bold tracking-tight">{naira(Math.round(p.net))}</p>
        <dl className="num mt-5 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Gross pay</dt><dd className="font-semibold">{naira(Math.round(p.gross))}</dd></div>
          {pension && <div className="flex justify-between text-ink-soft"><dt>Pension (8%)</dt><dd>−{naira(Math.round(p.pensionEmployee))}</dd></div>}
          {nhf && <div className="flex justify-between text-ink-soft"><dt>NHF (2.5%)</dt><dd>−{naira(Math.round(p.nhf))}</dd></div>}
          <div className="flex justify-between text-ink-soft"><dt>PAYE tax</dt><dd>−{naira(Math.round(p.paye))}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Take-home</dt><dd>{naira(Math.round(p.net))}</dd></div>
        </dl>
        <dl className="num mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Annual PAYE</dt><dd className="font-bold">{naira(Math.round(p.paye * 12))}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Effective tax rate</dt><dd className="font-bold">{effective.toFixed(1)}%</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Annual taxable income</dt><dd className="font-bold">{naira(Math.round(annualTaxable))}</dd></div>
          <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Employer pension (10%)</dt><dd className="font-bold">{naira(Math.round(p.pensionEmployer))}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted">2026 bands under the Nigeria Tax Act 2025. Pension is worked out on total gross. An estimate, not tax advice.</p>
      </div>
    </div>
  );
}

export function VatWhtCalculator() {
  const [amount, setAmount] = useState("1,000,000");
  const [vat, setVat] = useState(true);
  const [wht, setWht] = useState("5");
  const t = useMemo(() => computeTotals([{ description: "x", quantity: 1, unitPrice: parseAmount(amount) || 0 }], 0, vat ? TAX.vatRate : 0, Number(wht)), [amount, vat, wht]);
  return (
    <div className="grid gap-6 rounded-3xl border border-line bg-paper p-5 shadow-sm sm:p-8 lg:grid-cols-2">
      <div className="space-y-5">
        <Money id="amount" label="Invoice amount before VAT" value={amount} onChange={setAmount} />
        <label className="flex items-center gap-3"><input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="size-5 accent-brand" /> Add VAT at 7.5%</label>
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
      </div>
      <div className="rounded-2xl bg-canvas p-5" aria-live="polite">
        <p className="text-sm font-semibold text-muted">Your client pays you</p>
        <p className="num text-4xl font-bold tracking-tight">{naira(t.amountDue)}</p>
        <dl className="num mt-5 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Amount before VAT</dt><dd className="font-semibold">{naira(t.subtotal)}</dd></div>
          {vat && <div className="flex justify-between text-ink-soft"><dt>VAT (7.5%)</dt><dd>+{naira(t.vatAmount)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Invoice total</dt><dd>{naira(t.total)}</dd></div>
          {Number(wht) > 0 && <div className="flex justify-between text-ink-soft"><dt>Less WHT ({wht}% of amount before VAT)</dt><dd>−{naira(t.whtAmount)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Amount payable</dt><dd>{naira(t.amountDue)}</dd></div>
        </dl>
        <div className="mt-5 space-y-1 rounded-xl bg-paper p-3 text-sm">
          {vat && <p><strong>{naira(t.vatAmount)}</strong> VAT is due to the NRS by the 21st of next month.</p>}
          {Number(wht) > 0 && <p><strong>{naira(t.whtAmount)}</strong> WHT is a tax credit for you. Ask the client for the credit note.</p>}
        </div>
      </div>
    </div>
  );
}
