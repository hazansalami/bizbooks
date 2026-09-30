import "server-only";
import { checkReferral } from "./growth";
import { db } from "./db";
import { decryptSecret } from "./crypto";
import { newReference, startCheckout, verifyPayment, type Provider } from "./gateways";
import { applyPayment, platformReady, publicInvoiceUrl, type FullInvoice } from "./invoices";
import { GATEWAY_CURRENCIES } from "./currency";
import { balanceDue, money, naira, round2 } from "./money";
import { siteUrl } from "./site-url";
import { layout, sendEmail } from "./email";
import { PLATFORM_FEE, feeFor, startSplitCheckout, vatInFee, verifySplit } from "./platform-payments";

/** Paystack first, then Flutterwave, among gateways that can charge in the invoice's currency. */
export function pickGateway(inv: FullInvoice) {
  const usable = inv.business.gateways.filter((g) => g.enabled && (GATEWAY_CURRENCIES[g.provider] ?? ["NGN"]).includes(inv.currency));
  return usable.find((g) => g.provider === "PAYSTACK") ?? usable[0] ?? null;
}

/**
 * Where the client pays: BizBooks Payments when it's on for this business (naira invoices), otherwise the
 * business's own Paystack or Flutterwave keys.
 */
export async function startInvoiceCheckout(inv: FullInvoice, email: string) {
  const amount = balanceDue(inv);
  if (inv.kind !== "INVOICE" || ["PAID", "VOID"].includes(inv.status) || amount <= 0) {
    return { error: "This invoice can't be paid online." } as const;
  }
  const callback = new URL("/api/pay/callback", siteUrl());
  callback.searchParams.set("t", inv.publicToken);

  if (platformReady(inv)) {
    const account = inv.business.paymentAccount!;
    callback.searchParams.set("provider", "PAYSTACK");
    callback.searchParams.set("mode", "platform");
    return startSplitCheckout({
      reference: newReference(inv.id), amount, email, subaccount: account.subaccountCode!, fee: feeFor(amount, account.feeFreeLeft),
      callbackUrl: callback.toString(), invoiceId: inv.id, invoiceNumber: inv.number, customerName: inv.customer.name, businessName: inv.business.name,
    });
  }

  const gateway = pickGateway(inv);
  if (!gateway) return { error: "This invoice can't be paid online." } as const;
  const provider = gateway.provider as Provider;
  callback.searchParams.set("provider", provider);
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

const loadForSettle = (invoiceId: string) => db.invoice.findUnique({
  where: { id: invoiceId },
  include: { business: { include: { gateways: true, owner: true, paymentAccount: true } }, customer: true },
});
type SettleInvoice = NonNullable<Awaited<ReturnType<typeof loadForSettle>>>;

/**
 * Verify with the business's own gateway and record the payment. Shared by the browser redirect and
 * the webhook; whichever arrives second is a no-op thanks to the unique reference.
 */
export async function settleReference(invoiceId: string, provider: Provider, reference: string) {
  const inv = await loadForSettle(invoiceId);
  const gateway = inv?.business.gateways.find((g) => g.provider === provider);
  if (!inv || !gateway) return { ok: false as const };
  const v = await verifyPayment(provider, decryptSecret(gateway.secretKeyEnc), reference);
  if (!v || !v.paid || v.currency !== inv.currency || v.reference !== reference) return { ok: false as const };
  const r = await applyPayment(inv.id, { amount: v.amount, method: provider, reference, paidAt: v.paidAt, note: `Paid online via ${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"}` });
  if (r.ok && !("duplicate" in r && r.duplicate)) {
    await notifyPaid(inv, v.amount, r.fullyPaid, `The money is in your ${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"} account and will settle to your bank on your usual schedule.`);
  }
  return { ok: r.ok };
}

/**
 * BizBooks Payments: verify with BizBooks' Paystack account and check the money went to THIS business's
 * subaccount before recording anything. Fees are recorded on the payment and booked as a bank charge.
 */
export async function settlePlatformReference(invoiceId: string, reference: string) {
  const inv = await loadForSettle(invoiceId);
  const account = inv?.business.paymentAccount;
  if (!inv || !account?.subaccountCode) return { ok: false as const };
  const v = await verifySplit(reference);
  if (!v || !v.paid || v.currency !== "NGN" || v.reference !== reference || v.subaccountCode !== account.subaccountCode) return { ok: false as const };

  const r = await applyPayment(inv.id, {
    amount: v.amount, method: "PAYSTACK", reference, paidAt: v.paidAt, note: "Paid online via BizBooks Payments",
    viaPlatform: true, platformFee: v.platformFee, processorFee: v.processorFee,
  });
  if (r.ok && !("duplicate" in r && r.duplicate)) {
    const fees = round2(v.platformFee + v.processorFee);
    await db.$transaction([
      // A fee-free payment used one from the allowance (only payments that would otherwise carry a fee count).
      ...(v.platformFee === 0 && v.amount >= PLATFORM_FEE.freeBelow && account.feeFreeLeft > 0
        ? [db.paymentAccount.update({ where: { id: account.id }, data: { feeFreeLeft: { decrement: 1 } } })]
        : []),
      // Fees come off before settlement, so book them as an expense to keep the books matching the bank.
      ...(fees > 0 ? [db.expense.create({
        data: {
          businessId: inv.businessId, date: v.paidAt, amount: fees, category: "Bank charges", vendor: "BizBooks Payments",
          note: `Payment fees on ${inv.number}: Paystack ${naira(v.processorFee)}${v.platformFee ? `, BizBooks ${naira(v.platformFee)}` : ""}`,
          vatAmount: vatInFee(v.platformFee), method: "OTHER", paid: true, paidAt: v.paidAt,
        },
      })] : []),
    ]);
    if (inv.business.referredById) await checkReferral(inv.businessId);
    const settles = round2(v.amount - fees);
    await notifyPaid(inv, v.amount, r.fullyPaid, `${naira(settles)} settles straight to your ${account.bankName} account ending ${account.accountNumber.slice(-4)} on Paystack's next settlement (fees ${naira(fees)}).`);
  }
  return { ok: r.ok };
}

async function notifyPaid(inv: SettleInvoice, amount: number, fullyPaid: boolean | undefined, whereMoney: string) {
  const to = inv.business.email || inv.business.owner.email;
  const { html, text } = layout({
    heading: `${inv.customer.name} paid ${money(amount, inv.currency)}`,
    paragraphs: [`Invoice ${inv.number} ${fullyPaid ? "is now fully paid" : "has a new part payment"}. ${whereMoney}`],
    button: { label: "View invoice", href: new URL(`/app/invoices/${inv.id}`, siteUrl()).toString() },
  });
  await sendEmail({ to, subject: `Payment received: ${money(amount, inv.currency)} for ${inv.number}`, html, text });
  if (inv.customer.email) {
    const receipt = layout({
      heading: `Payment received, thank you`,
      paragraphs: [`${inv.business.name} has received your payment of <strong>${money(amount, inv.currency)}</strong> for invoice ${inv.number}.`],
      button: { label: "View receipt", href: publicInvoiceUrl(inv.publicToken) },
    });
    await sendEmail({ to: inv.customer.email, subject: `Receipt for ${inv.number} from ${inv.business.name}`, html: receipt.html, text: receipt.text, replyTo: inv.business.email, fromName: inv.business.name });
  }
}
