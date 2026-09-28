/**
 * Invoice currencies. The books stay in naira: each foreign-currency invoice and payment carries a
 * rate (naira per 1 unit) that reports convert with, the way Wave handles multi-currency invoicing.
 */
export const CURRENCIES = [
  { code: "NGN", name: "Nigerian naira", major: "naira", minor: "kobo" },
  { code: "USD", name: "US dollar", major: "US dollars", minor: "cents" },
  { code: "GBP", name: "British pound", major: "pounds", minor: "pence" },
  { code: "EUR", name: "Euro", major: "euros", minor: "cents" },
  { code: "CAD", name: "Canadian dollar", major: "Canadian dollars", minor: "cents" },
  { code: "GHS", name: "Ghanaian cedi", major: "cedis", minor: "pesewas" },
  { code: "KES", name: "Kenyan shilling", major: "Kenyan shillings", minor: "cents" },
  { code: "ZAR", name: "South African rand", major: "rand", minor: "cents" },
  { code: "XOF", name: "West African CFA franc", major: "CFA francs", minor: "centimes" },
  { code: "AED", name: "UAE dirham", major: "dirhams", minor: "fils" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const HOME_CURRENCY: CurrencyCode = "NGN";

export function isCurrency(v: unknown): v is CurrencyCode {
  return CURRENCIES.some((c) => c.code === v);
}

export function currencyInfo(code: string) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Currencies each gateway can charge in (subject to the merchant's own account settings). */
export const GATEWAY_CURRENCIES: Record<string, string[]> = {
  PAYSTACK: ["NGN", "USD", "GHS", "ZAR", "KES"],
  FLUTTERWAVE: ["NGN", "USD", "GBP", "EUR", "CAD", "GHS", "KES", "ZAR", "XOF"],
};

/** Naira value of an amount in another currency. */
export function toNgn(amount: number, rate: number | null | undefined) {
  return Math.round((amount * (rate && rate > 0 ? rate : 1) + Number.EPSILON) * 100) / 100;
}
