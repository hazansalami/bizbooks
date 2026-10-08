import { checkReferral } from "@/lib/growth";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { canPayOnline, loadFullInvoice } from "@/lib/invoices";
import { pickGateway } from "@/lib/checkout";
import { getCurrentUser } from "@/lib/auth";
import { balanceDue, computeTotals, money } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Notice } from "@/components/ui";
import { DownloadPdfButton } from "@/components/pdf-download";
import { InvoiceDocument } from "@/components/invoice-document";
import { PayPanel } from "./pay-panel";
import { QuoteAccept } from "./quote-accept";

const LINK_PREVIEW_BOTS = /bot\b|bot\/|crawler|spider|preview|whatsapp|facebookexternalhit|slack|telegram|discord|skype|linkedin|twitter|google|bing|yahoo|outlook|microsoft office|safelinks|proofpoint|mimecast|barracuda|curl|wget|python|node-fetch|axios|headless/i;

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string }> };

async function load(token: string) {
  const found = await db.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
  return found ? loadFullInvoice(found.id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const inv = await load((await params).token);
  if (!inv) return { title: "Invoice not found", robots: { index: false } };
  const label = inv.kind === "QUOTE" ? "Quote" : "Invoice";
  return {
    title: `${label} ${inv.number} from ${inv.business.name}`,
    description: `${label} for ${money(inv.kind === "QUOTE" ? inv.total : balanceDue(inv), inv.currency)}, ${inv.kind === "QUOTE" ? "valid until" : "due"} ${formatDate(inv.dueDate)}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoice({ params, searchParams }: Props) {
  const { token } = await params;
  const { payment } = await searchParams;
  const inv = await load(token);
  if (!inv) notFound();

  // Count the first view by anyone other than the owner. Link previews (WhatsApp, email scanners, chat apps)
  // fetch the page the moment it's shared, so they don't count as the client opening it.
  const viewer = await getCurrentUser();
  const ua = (await headers()).get("user-agent") ?? "";
  if (!inv.viewedAt && viewer?.id !== inv.business.ownerId && viewer?.business?.id !== inv.businessId && ua && !LINK_PREVIEW_BOTS.test(ua)) {
    await db.invoice.update({ where: { id: inv.id }, data: { viewedAt: new Date(), events: { create: { type: "VIEWED" } } } });
    if (inv.business.referredById) await checkReferral(inv.businessId);
  }

  const due = balanceDue(inv);
  const payable = inv.kind === "INVOICE" && !["PAID", "VOID"].includes(inv.status) && due > 0;
  const gateway = pickGateway(inv);

  return (
    <div className="min-h-dvh bg-canvas">
      <main className="mx-auto max-w-3xl space-y-4 px-3 py-6 sm:px-6 sm:py-10">
        {payment === "success" && (
          <Notice tone="brand" title="Payment received. Thank you.">{inv.business.name} has been notified and your receipt is below.</Notice>
        )}
        {payment === "pending" && (
          <Notice tone="sun" title="We're still confirming your payment">If money left your account, it will show here shortly. There's no need to pay again.</Notice>
        )}
        {payment === "failed" && <Notice tone="danger" title="That payment didn't go through">You weren't charged. You can try again below or pay by transfer.</Notice>}
        {payment === "cancelled" && <Notice tone="info">Payment cancelled. You can try again whenever you're ready.</Notice>}

        {inv.status === "PAID" && payment !== "success" && (
          <div className="no-print flex items-center gap-3 rounded-2xl bg-brand-wash p-4 text-brand-deep">
            <CheckCircle2 className="size-6 shrink-0" aria-hidden />
            <p><strong>Paid in full{inv.paidAt ? ` on ${formatDate(inv.paidAt)}` : ""}.</strong> Keep this page as your receipt.</p>
          </div>
        )}
        {inv.status === "VOID" && (
          <div className="no-print flex items-center gap-3 rounded-2xl bg-sun-wash p-4 text-sun-ink">
            <CircleAlert className="size-6 shrink-0" aria-hidden />
            <p>This invoice has been cancelled by {inv.business.name}. Please don't pay it.</p>
          </div>
        )}

        {payable && (
          <PayPanel
            token={token}
            businessName={inv.business.name}
            balance={due}
            currency={inv.currency}
            online={canPayOnline(inv)}
            providerName={gateway?.provider === "FLUTTERWAVE" ? "Flutterwave" : "Paystack"}
            needsEmail={!inv.customer.email}
            banks={inv.business.bankAccounts.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).map(({ id, bankName, accountNumber, accountName }) => ({ id, bankName, accountNumber, accountName }))}
            number={inv.number}
            color={inv.business.brandColor}
          />
        )}

        {inv.kind === "QUOTE" && ["SENT", "DRAFT"].includes(inv.status) && (
          <QuoteAccept
            token={token}
            businessName={inv.business.name}
            number={inv.number}
            total={inv.total}
            depositPercent={inv.depositPercent}
            deposit={inv.depositPercent ? Math.round(computeTotals(inv.items, inv.discount, 0, 0).taxable * inv.depositPercent) / 100 : 0}
          />
        )}
        {inv.kind === "QUOTE" && inv.acceptedAt && (
          <div className="no-print flex items-center gap-3 rounded-2xl bg-brand-wash p-4 text-brand-deep">
            <CheckCircle2 className="size-6 shrink-0" aria-hidden />
            <p>Accepted by {inv.acceptedBy} on {formatDate(inv.acceptedAt)}.</p>
          </div>
        )}

        <InvoiceDocument inv={inv} />

        <div className="no-print flex justify-center">
          <DownloadPdfButton filename={`${inv.business.name} ${inv.number}${inv.status === "PAID" ? " receipt" : ""}.pdf`}>{inv.status === "PAID" ? "Download receipt (PDF)" : "Download PDF"}</DownloadPdfButton>
        </div>
      </main>
    </div>
  );
}
