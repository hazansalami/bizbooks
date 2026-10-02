import { round2 } from "./money";

/* Payment fees, shared by the server (checkout) and public pages that explain them. */

/** BizBooks Payments' flat fee per successful payment, VAT inclusive. Payments below the threshold carry no fee. */
export const PLATFORM_FEE = { amount: 500, vatRate: 7.5, freeBelow: 2500 } as const;

/** Paystack's own local fee (borne by the business, like on their own account): 1.5% + ₦100 above ₦2,500, capped at ₦2,000. */
export function paystackFee(amount: number) {
  return round2(Math.min(2000, amount * 0.015 + (amount >= 2500 ? 100 : 0)));
}
