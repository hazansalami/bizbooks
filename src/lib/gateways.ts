import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { round2 } from "./money";

/*
  Each business connects its OWN Paystack or Flutterwave account. Customers pay the business
  directly; BizBooks only starts the checkout with the business's key and reads the result.
  We never receive, hold or move customer money, so no payment licence is needed for this part.
*/

export type Provider = "PAYSTACK" | "FLUTTERWAVE";
export const PROVIDERS: Record<Provider, { name: string; dashboard: string; keysUrl: string }> = {
  PAYSTACK: {
    name: "Paystack",
    dashboard: "https://dashboard.paystack.com",
    keysUrl: "https://dashboard.paystack.com/#/settings/developers",
  },
  FLUTTERWAVE: {
    name: "Flutterwave",
    dashboard: "https://app.flutterwave.com",
    keysUrl: "https://app.flutterwave.com/dashboard/settings/apis/live",
  },
};

export function keyMode(provider: Provider, secretKey: string): "TEST" | "LIVE" | null {
  if (provider === "PAYSTACK") {
    if (secretKey.startsWith("sk_live_")) return "LIVE";
    if (secretKey.startsWith("sk_test_")) return "TEST";
    return null;
  }
  if (secretKey.startsWith("FLWSECK_TEST-")) return "TEST";
  if (secretKey.startsWith("FLWSECK-")) return "LIVE";
  return null;
}

async function call<T>(url: string, secretKey: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; status: number; json: T | null }> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

/** A cheap read-only call that only succeeds with a valid secret key. */
export async function checkKey(provider: Provider, secretKey: string) {
  const url = provider === "PAYSTACK"
    ? "https://api.paystack.co/transaction?perPage=1"
    : "https://api.flutterwave.com/v3/banks/NG";
  const r = await call(url, secretKey);
  if (r.ok) return { ok: true as const };
  if (r.status === 401 || r.status === 403) return { ok: false as const, error: "That key was rejected. Copy the secret key again from your dashboard." };
  return { ok: false as const, error: "We couldn't reach the payment company just now. Try again in a minute." };
}

export type CheckoutInput = {
  reference: string; amount: number; currency: string; email: string; customerName: string; phone?: string | null;
  callbackUrl: string; businessName: string; invoiceNumber: string; invoiceId: string;
};

export async function startCheckout(provider: Provider, secretKey: string, input: CheckoutInput): Promise<{ url: string } | { error: string }> {
  if (provider === "PAYSTACK") {
    const r = await call<{ status: boolean; message: string; data?: { authorization_url: string } }>(
      "https://api.paystack.co/transaction/initialize", secretKey, {
        method: "POST",
        body: {
          email: input.email,
          amount: Math.round(input.amount * 100),
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: {
            invoice_id: input.invoiceId,
            custom_fields: [
              { display_name: "Invoice", variable_name: "invoice", value: input.invoiceNumber },
              { display_name: "Customer", variable_name: "customer", value: input.customerName },
            ],
          },
        },
      });
    if (r.ok && r.json?.data?.authorization_url) return { url: r.json.data.authorization_url };
    return { error: r.json?.message || "Paystack couldn't start the payment." };
  }
  const r = await call<{ status: string; message: string; data?: { link: string } }>(
    "https://api.flutterwave.com/v3/payments", secretKey, {
      method: "POST",
      body: {
        tx_ref: input.reference,
        amount: round2(input.amount),
        currency: input.currency,
        redirect_url: input.callbackUrl,
        customer: { email: input.email, name: input.customerName, phonenumber: input.phone ?? undefined },
        customizations: { title: input.businessName, description: `Invoice ${input.invoiceNumber}` },
        meta: { invoice_id: input.invoiceId },
      },
    });
  if (r.ok && r.json?.data?.link) return { url: r.json.data.link };
  return { error: r.json?.message || "Flutterwave couldn't start the payment." };
}

export type VerifiedPayment = { paid: boolean; amount: number; reference: string; paidAt: Date; currency: string };

/** Always ask the gateway directly. Never trust amounts from a redirect URL. */
export async function verifyPayment(provider: Provider, secretKey: string, reference: string): Promise<VerifiedPayment | null> {
  if (provider === "PAYSTACK") {
    const r = await call<{ data?: { status: string; amount: number; currency: string; reference: string; paid_at?: string } }>(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, secretKey);
    const d = r.json?.data;
    if (!r.ok || !d) return null;
    return { paid: d.status === "success", amount: d.amount / 100, reference: d.reference, currency: d.currency, paidAt: d.paid_at ? new Date(d.paid_at) : new Date() };
  }
  const r = await call<{ data?: { status: string; amount: number; currency: string; tx_ref: string; created_at?: string } }>(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, secretKey);
  const d = r.json?.data;
  if (!r.ok || !d) return null;
  return { paid: d.status === "successful", amount: d.amount, reference: d.tx_ref, currency: d.currency, paidAt: d.created_at ? new Date(d.created_at) : new Date() };
}

export function paystackSignatureValid(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

export function flutterwaveHashValid(header: string | null, secretHash: string) {
  return !!header && safeEqual(header, secretHash);
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Our references carry the invoice id so a webhook can find it: bb-<invoiceId>-<random>. */
export function newReference(invoiceId: string) {
  return `bb-${invoiceId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function invoiceIdFromReference(reference: string) {
  const m = /^bb-([a-z0-9]+)-[a-z0-9]+$/.exec(reference);
  return m?.[1] ?? null;
}
