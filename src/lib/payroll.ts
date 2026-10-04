import { TAX } from "./constants";
import { round2 } from "./money";

/*
  Monthly pay under the Nigeria Tax Act 2025 (from 1 January 2026).
  Simplifications, shown to owners on the payroll screens:
  - Monthly gross is treated as the pensionable pay (basic + housing + transport). Companies with large
    other allowances will see slightly high pension and slightly low PAYE.
  - NHF is 2.5% of gross for staff who opt in (strictly it's 2.5% of basic).
  - Rent relief is 20% of the rent the employee declares, capped at ₦500,000 a year.
*/

/** paye: false when the employee settles their own income tax, so none is deducted (defaults to deducting it). */
export type PayInput = { kind: string; monthlyGross: number; pension: boolean; nhf: boolean; annualRent: number; whtRate: number; paye?: boolean };
/**
 * Why PAYE is what it is: DEDUCTED (tax worked out), MIN_WAGE (exempt: earns the minimum wage or less),
 * TAX_FREE (taxable income within the ₦800,000-a-year 0% band), SELF (employee handles their own tax), NONE (contractor).
 */
export type PayeStatus = "DEDUCTED" | "MIN_WAGE" | "TAX_FREE" | "SELF" | "NONE";

export type PayResult = {
  gross: number; pensionEmployee: number; pensionEmployer: number; nhf: number; rentRelief: number; paye: number; wht: number; net: number;
  payeStatus: PayeStatus;
};

/** What to show on the PAYE line: the deduction, or plainly why there isn't one (never "−₦0"). */
export function payeLine(p: { paye: number; payeStatus: PayeStatus }, fmt: (n: number) => string) {
  switch (p.payeStatus) {
    case "DEDUCTED": return `−${fmt(p.paye)}`;
    case "MIN_WAGE": return "Exempt (minimum wage)";
    case "TAX_FREE": return "None (under the tax-free band)";
    case "SELF": return "Employee pays";
    default: return "—";
  }
}

/** Tax on a yearly taxable income, band by band. */
export function annualIncomeTax(taxable: number) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of TAX.payeBands) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * (rate / 100);
    lower = upper;
  }
  return round2(tax);
}

export function computePay(e: PayInput): PayResult {
  const gross = round2(e.monthlyGross);
  if (e.kind === "CONTRACTOR") {
    // Contractors aren't on PAYE or pension: the company deducts withholding tax and remits it instead.
    const wht = round2((gross * e.whtRate) / 100);
    return { gross, pensionEmployee: 0, pensionEmployer: 0, nhf: 0, rentRelief: 0, paye: 0, wht, net: round2(gross - wht), payeStatus: "NONE" };
  }
  const pensionEmployee = e.pension ? round2((gross * TAX.pensionEmployee) / 100) : 0;
  const pensionEmployer = e.pension ? round2((gross * TAX.pensionEmployer) / 100) : 0;
  const nhf = e.nhf ? round2((gross * TAX.nhf) / 100) : 0;
  const rentReliefYear = Math.min((Math.max(0, e.annualRent) * TAX.rentReliefRate) / 100, TAX.rentReliefCap);
  const taxableYear = Math.max(0, gross * 12 - (pensionEmployee + nhf) * 12 - rentReliefYear);
  const minWage = gross <= TAX.minimumWageMonthly;
  const tax = round2(annualIncomeTax(taxableYear) / 12);
  const payeStatus: PayeStatus = e.paye === false ? "SELF" : minWage ? "MIN_WAGE" : tax > 0 ? "DEDUCTED" : "TAX_FREE";
  const paye = payeStatus === "DEDUCTED" ? tax : 0;
  return {
    gross, pensionEmployee, pensionEmployer, nhf, rentRelief: round2(rentReliefYear / 12), paye, wht: 0,
    net: round2(gross - pensionEmployee - nhf - paye), payeStatus,
  };
}

/** "2026-10" → "October 2026" */
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function periodOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Pay day in a given month, pulled back to Friday when it lands on a weekend. */
export function payDateFor(period: string, payDay: number) {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const d = new Date(y, m - 1, Math.min(payDay, last));
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  return d;
}
