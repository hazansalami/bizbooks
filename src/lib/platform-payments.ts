import "server-only";
import { round2 } from "./money";
import { PLATFORM_FEE, paystackFee } from "./fees";

/*
  BizBooks Payments: businesses add a bank account (verified with Paystack's account-name lookup) instead of
  pasting their own API keys. Each becomes a subaccount on BizBooks' Paystack account. Clients pay through our
  checkout; Paystack settles the business's share straight to its bank and our flat fee to us. BizBooks never
  holds, pools or pays out customer money.

  Live only when PAYMENTS_ENABLED=true and PLATFORM_PAYSTACK_SECRET_KEY is set (keep it off until Paystack has
  approved the split-payments use case). In development without a key it runs in test mode: realistic fake
  responses and a simulated checkout page, so the whole flow can be tried locally.
*/

export { PLATFORM_FEE, paystackFee };
export const vatInFee = (fee: number) => round2((fee * PLATFORM_FEE.vatRate) / (100 + PLATFORM_FEE.vatRate));

const key = () => process.env.PLATFORM_PAYSTACK_SECRET_KEY || "";
export const testMode = () => !key() && process.env.NODE_ENV !== "production";
export function paymentsEnabled() {
  return testMode() || (process.env.PAYMENTS_ENABLED === "true" && !!key());
}

async function paystack<T>(path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; json: T | null; message?: string }> {
  try {
    const res = await fetch(`https://api.paystack.co${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
    return { ok: res.ok, json, message: json?.message };
  } catch {
    return { ok: false, json: null, message: "We couldn't reach Paystack just now. Try again in a minute." };
  }
}

/* ---------- Banks and account verification ---------- */

export type Bank = { name: string; code: string };
const TEST_BANKS: Bank[] = [
  { name: "Access Bank", code: "044" }, { name: "First Bank of Nigeria", code: "011" }, { name: "Guaranty Trust Bank", code: "058" },
  { name: "Keystone Bank", code: "082" }, { name: "Moniepoint MFB", code: "50515" }, { name: "Opay", code: "999992" },
  { name: "Providus Bank", code: "101" }, { name: "Stanbic IBTC Bank", code: "221" }, { name: "Sterling Bank", code: "232" },
  { name: "United Bank For Africa", code: "033" }, { name: "Wema Bank", code: "035" }, { name: "Zenith Bank", code: "057" },
];

const bankCache = globalThis as unknown as { __bbBanks?: { at: number; banks: Bank[] } };

/** Nigerian banks that can receive settlements, cached for a day. */
export async function listBanks(): Promise<Bank[]> {
  if (testMode()) return TEST_BANKS;
  if (bankCache.__bbBanks && Date.now() - bankCache.__bbBanks.at < 86_400_000) return bankCache.__bbBanks.banks;
  const r = await paystack<{ data?: { name: string; code: string; active?: boolean }[] }>("/bank?country=nigeria&currency=NGN&perPage=200");
  const banks = (r.json?.data ?? []).filter((b) => b.active !== false).map((b) => ({ name: b.name, code: b.code })).sort((a, b) => a.name.localeCompare(b.name));
  if (banks.length) bankCache.__bbBanks = { at: Date.now(), banks };
  return banks;
}

/**
 * The account holder's name as the bank has it. In test mode, account numbers starting "01" return the
 * business's own name (a match) and anything else returns a stranger's name, so both paths can be tried.
 */
export async function resolveAccount(accountNumber: string, bankCode: string, testName?: string): Promise<{ ok: true; accountName: string } | { ok: false; error: string }> {
  if (!/^\d{10}$/.test(accountNumber)) return { ok: false, error: "Enter the 10-digit account number (NUBAN)." };
  if (testMode()) return { ok: true, accountName: accountNumber.startsWith("01") ? (testName ?? "TEST BUSINESS LTD").toUpperCase() : "ADEWALE JOHNSON OKAFOR" };
  const r = await paystack<{ data?: { account_name?: string } }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`);
  const name = r.json?.data?.account_name;
  return name ? { ok: true, accountName: name } : { ok: false, error: "We couldn't find that account. Check the bank and the account number." };
}

const NOISE = new Set(["ltd", "limited", "plc", "nig", "nigeria", "enterprise", "enterprises", "ventures", "services", "company", "co", "and", "the", "global", "intl", "international", "rc", "bn"]);
const words = (s: string) => s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !NOISE.has(w));

/**
 * Settlement accounts must belong to the business itself: the bank's account name has to match the trading
 * or registered name. Anything else goes to manual review (a personal account can't be used silently).
 */
export function accountMatchesBusiness(accountName: string, names: (string | null | undefined)[]) {
  const acct = new Set(words(accountName));
  return names.filter(Boolean).some((n) => {
    const w = words(n!);
    if (!w.length) return false;
    const hits = w.filter((x) => acct.has(x)).length;
    return hits / w.length >= 0.6;
  });
}

/* ---------- Subaccounts ---------- */

export async function createSubaccount(i: { businessName: string; bankCode: string; accountNumber: string; email: string; businessId: string }) {
  if (testMode()) return { ok: true as const, code: `ACCT_test_${i.businessId.slice(-8)}` };
  const r = await paystack<{ data?: { subaccount_code?: string } }>("/subaccount", {
    method: "POST",
    body: {
      business_name: i.businessName.slice(0, 100), settlement_bank: i.bankCode, account_number: i.accountNumber,
      // Our fee is charged per transaction (transaction_charge), not as a percentage.
      percentage_charge: 0, primary_contact_email: i.email, description: `BizBooks business ${i.businessId}`,
      metadata: { business_id: i.businessId },
    },
  });
  const code = r.json?.data?.subaccount_code;
  return code ? { ok: true as const, code } : { ok: false as const, error: r.message || "Paystack couldn't set up the settlement account." };
}

export async function updateSubaccount(code: string, i: { bankCode: string; accountNumber: string; businessName: string }) {
  if (testMode()) return { ok: true as const, code };
  const r = await paystack(`/subaccount/${encodeURIComponent(code)}`, {
    method: "PUT", body: { business_name: i.businessName.slice(0, 100), settlement_bank: i.bankCode, account_number: i.accountNumber },
  });
  return r.ok ? { ok: true as const, code } : { ok: false as const, error: r.message || "Paystack couldn't update the settlement account." };
}

/* ---------- Split checkout ---------- */

type TestTx = { amount: number; fee: number; subaccount: string; email: string; paid: boolean; paidAt?: Date };
const testTx = globalThis as unknown as { __bbTestTx?: Map<string, TestTx> };
const txStore = () => (testTx.__bbTestTx ??= new Map());

/** The BizBooks fee for a payment of this size, given the business's remaining fee-free allowance. */
export function feeFor(amount: number, feeFreeLeft: number) {
  if (amount < PLATFORM_FEE.freeBelow || feeFreeLeft > 0) return 0;
  return PLATFORM_FEE.amount;
}

export async function startSplitCheckout(i: {
  reference: string; amount: number; email: string; subaccount: string; fee: number; callbackUrl: string;
  invoiceId: string; invoiceNumber: string; customerName: string; businessName: string;
}): Promise<{ url: string } | { error: string }> {
  if (testMode()) {
    txStore().set(i.reference, { amount: round2(i.amount), fee: i.fee, subaccount: i.subaccount, email: i.email, paid: false });
    const u = new URL(i.callbackUrl);
    return { url: `${u.origin}/pay/test-checkout?reference=${encodeURIComponent(i.reference)}&next=${encodeURIComponent(u.pathname + u.search)}` };
  }
  const r = await paystack<{ data?: { authorization_url?: string } }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: i.email, amount: Math.round(i.amount * 100), currency: "NGN", reference: i.reference, callback_url: i.callbackUrl,
      subaccount: i.subaccount,
      // Business bears Paystack's fee, exactly as on its own account; our flat fee goes to BizBooks.
      bearer: "subaccount",
      ...(i.fee > 0 ? { transaction_charge: Math.round(i.fee * 100) } : {}),
      metadata: {
        invoice_id: i.invoiceId, platform: "bizbooks-payments",
        custom_fields: [
          { display_name: "Invoice", variable_name: "invoice", value: i.invoiceNumber },
          { display_name: "Pay to", variable_name: "business", value: i.businessName },
          { display_name: "Customer", variable_name: "customer", value: i.customerName },
        ],
      },
    },
  });
  const url = r.json?.data?.authorization_url;
  return url ? { url } : { error: r.message || "Paystack couldn't start the payment." };
}

/** Test mode only: the simulated checkout marks the transaction paid. */
export function completeTestCheckout(reference: string) {
  const tx = testMode() ? txStore().get(reference) : undefined;
  if (!tx) return null;
  tx.paid = true;
  tx.paidAt = new Date();
  return tx;
}
export function testCheckoutDetails(reference: string) {
  return testMode() ? txStore().get(reference) ?? null : null;
}

export type SplitVerified = {
  paid: boolean; amount: number; currency: string; reference: string; paidAt: Date;
  subaccountCode: string | null; platformFee: number; processorFee: number;
};

/** Always ask Paystack directly; never trust a redirect or webhook body for amounts or who gets paid. */
export async function verifySplit(reference: string): Promise<SplitVerified | null> {
  if (testMode()) {
    const tx = txStore().get(reference);
    if (!tx) return null;
    return { paid: tx.paid, amount: tx.amount, currency: "NGN", reference, paidAt: tx.paidAt ?? new Date(), subaccountCode: tx.subaccount, platformFee: tx.fee, processorFee: paystackFee(tx.amount) };
  }
  const r = await paystack<{ data?: {
    status: string; amount: number; currency: string; reference: string; paid_at?: string;
    subaccount?: { subaccount_code?: string } | null; fees?: number;
    fees_split?: { paystack?: number; integration?: number } | null;
  } }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const d = r.json?.data;
  if (!d) return null;
  return {
    paid: d.status === "success", amount: d.amount / 100, currency: d.currency, reference: d.reference,
    paidAt: d.paid_at ? new Date(d.paid_at) : new Date(), subaccountCode: d.subaccount?.subaccount_code ?? null,
    platformFee: (d.fees_split?.integration ?? 0) / 100, processorFee: (d.fees_split?.paystack ?? d.fees ?? 0) / 100,
  };
}
