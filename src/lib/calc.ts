import { TAX } from "./constants";
import { round2 } from "./money";
import { computePay, type PayInput } from "./payroll";

/** Gross monthly pay needed for a target take-home, found by bisection on the PAYE engine. */
export function grossUp(targetNet: number, opts: Omit<PayInput, "monthlyGross" | "kind" | "whtRate">) {
  if (!(targetNet > 0)) return computePay({ ...opts, kind: "EMPLOYEE", monthlyGross: 0, whtRate: 0 });
  let lo = targetNet, hi = targetNet * 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (computePay({ ...opts, kind: "EMPLOYEE", monthlyGross: mid, whtRate: 0 }).net < targetNet) lo = mid;
    else hi = mid;
  }
  // Round up to the next naira so take-home is never below the target.
  return computePay({ ...opts, kind: "EMPLOYEE", monthlyGross: Math.ceil(hi), whtRate: 0 });
}

export type EmployerCostInput = { monthlyGross: number; staff: number; bigTurnover: boolean; annualRent: number };

/** What one employee really costs the company each month: pay + employer pension + NSITF + ITF. */
export function employerCost(i: EmployerCostInput) {
  const pensionApplies = i.staff >= 3;
  const itfApplies = i.staff >= 5 || i.bigTurnover;
  const pay = computePay({ kind: "EMPLOYEE", monthlyGross: i.monthlyGross, pension: pensionApplies, nhf: false, annualRent: i.annualRent, whtRate: 0 });
  const pensionEmployer = pensionApplies ? round2((i.monthlyGross * TAX.pensionEmployer) / 100) : 0;
  const nsitf = round2((i.monthlyGross * TAX.nsitf) / 100);
  const itf = itfApplies ? round2((i.monthlyGross * TAX.itf) / 100) : 0;
  const monthly = round2(i.monthlyGross + pensionEmployer + nsitf + itf);
  return { pay, pensionEmployer, nsitf, itf, monthly, annual: round2(monthly * 12), pensionApplies, itfApplies, onTop: round2(monthly - i.monthlyGross) };
}

export type CompanyTaxInput = { turnover: number; fixedAssets: number; professional: boolean; taxableProfit: number; assessableProfit: number };

/**
 * Company income tax and development levy under the Nigeria Tax Act 2025 (estimate).
 * Small company: turnover ≤ ₦100m, fixed assets ≤ ₦250m, not professional services → 0% CIT, no levy.
 * Otherwise 30% CIT on taxable profit and 4% development levy on assessable profit.
 */
export function companyTax(i: CompanyTaxInput) {
  const reasons: string[] = [];
  if (i.turnover > TAX.smallCompanyTurnover) reasons.push("turnover is above ₦100 million");
  if (i.fixedAssets > TAX.smallCompanyFixedAssets) reasons.push("fixed assets are above ₦250 million");
  if (i.professional) reasons.push("it provides professional services");
  const small = reasons.length === 0;
  const cit = small ? 0 : round2((Math.max(0, i.taxableProfit) * TAX.standardCitRate) / 100);
  const levy = small ? 0 : round2((Math.max(0, i.assessableProfit) * 4) / 100);
  const total = round2(cit + levy);
  const effective = i.taxableProfit > 0 ? (total / i.taxableProfit) * 100 : 0;
  return { small, reasons, cit, levy, total, effective, large: i.turnover >= 50_000_000_000 };
}

/** Add VAT to a net amount, or take it out of a VAT-inclusive total. */
export function vatSplit(amount: number, mode: "add" | "remove", rate = TAX.vatRate) {
  const net = mode === "add" ? amount : amount / (1 + rate / 100);
  const vat = (net * rate) / 100;
  return { net: round2(net), vat: round2(vat), gross: round2(net + vat) };
}
