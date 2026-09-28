import "server-only";
import { db } from "./db";
import { decryptSecret } from "./crypto";
import { newReference, startCheckout, verifyPayment, type Provider } from "./gateways";
import { applyPayment, publicInvoiceUrl, type FullInvoice } from "./invoices";
import { GATEWAY_CURRENCIES } from "./currency";
import { balanceDue, money } from "./money";
import { siteUrl } from "./site-url";
import { layout, sendEmail } from "./email";

/** Paystack first, then Flutterwave, among gateways that can charge in the invoice's currency. */
export function pickGateway(inv: FullInvoice) {
  const usable = inv.business.gateways.filter((g) => g.enabled && (GATEWAY_CURRENCIES[g.provider] ?? ["NGN"]).includes(inv.currency));
  return usable.find((g) => g.provider === "PAYSTACK") ?? usable[0] ?? null;
}

export async function startInvoiceCheckout(inv: FullInvoice, email: string) {
  const gateway = pickGateway(inv);
  const amount = balanceDue(inv);
  if (!gateway || inv.kind !== "INVOICE" || ["PAID", "VOID"].includes(inv.status) || amount <= 0) {
    return { error: "This invoice can't be paid online." } as const;
  }
  const provider = gateway.provider as Provider;
  const callback = new URL("/api/pay/callback", siteUrl());
  callback.searchParams.set("provider", provider);
  callback.searchParams.set("t", inv.publicToken);
  return startCheckout(provider, decryptSecret(gateway.secretKeyEnc), {
    reference: newReference(inv.id),
    amount,
    currency: inv.currency,
    email,
    customerName: inv.customer.name,
    phone: inv.customer.phone,
    callbackUrl: callback.toString(),
    businessName: inv.business.name,
    invoiceNumber: inv.number,
    invoiceId: inv.id,
  });
}

/**
 * Verify with the business's gateway and record the payment. Shared by the browser redirect and
 * the webhook; whichever arrives second is a no-op thanks to the unique reference.
 */
export async function settleReference(invoiceId: string, provider: Provider, reference: string) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { business: { include: { gateways: true, owner: true } }, customer: true },
  });
  const gateway = inv?.business.gateways.find((g) => g.provider === provider);
  if (!inv || !gateway) return { ok: false as const };
  const v = await verifyPayment(provider, decryptSecret(gateway.secretKeyEnc), reference);
  if (!v || !v.paid || v.currency !== inv.currency || v.reference !== reference) return { ok: false as const };
  const r = await applyPayment(inv.id, { amount: v.amount, method: provider, reference, paidAt: v.paidAt, note: `Paid online via ${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"}` });
  if (r.ok && !("duplicate" in r && r.duplicate)) {
    const to = inv.business.email || inv.business.owner.email;
    const { html, text } = layout({
      heading: `${inv.customer.name} paid ${money(v.amount, inv.currency)}`,
      paragraphs: [`Invoice ${inv.number} ${r.fullyPaid ? "is now fully paid" : "has a new part payment"}. The money is in your ${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"} account and will settle to your bank on your usual schedule.`],
      button: { label: "View invoice", href: new URL(`/app/invoices/${inv.id}`, siteUrl()).toString() },
    });
    await sendEmail({ to, subject: `Payment received: ${money(v.amount, inv.currency)} for ${inv.number}`, html, text });
    if (inv.customer.email) {
      const receipt = layout({
        heading: `Payment received, thank you`,
        paragraphs: [`${inv.business.name} has received your payment of <strong>${money(v.amount, inv.currency)}</strong> for invoice ${inv.number}.`],
        button: { label: "View receipt", href: publicInvoiceUrl(inv.publicToken) },
      });
      await sendEmail({ to: inv.customer.email, subject: `Receipt for ${inv.number} from ${inv.business.name}`, html: receipt.html, text: receipt.text, replyTo: inv.business.email, fromName: inv.business.name });
    }
  }
  return { ok: r.ok };
}
