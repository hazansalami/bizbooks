import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadReceipt } from "@/lib/receipts";
import { ReceiptDocument } from "@/components/receipt-document";
import { DownloadPdfButton } from "@/components/pdf-download";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Payment receipt", robots: { index: false, follow: false } };

/** The client's receipt for one payment. Private link: anyone with it can view, nobody can change it. */
export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadReceipt(token);
  if (!r) notFound();
  return (
    <div className="min-h-dvh bg-canvas">
      <main className="mx-auto max-w-2xl space-y-4 px-3 py-6 doc:py-10">
        <ReceiptDocument r={r} />
        <div className="no-print flex flex-wrap justify-center gap-2">
          <DownloadPdfButton filename={`${r.b.name} receipt ${r.p.receiptNumber}.pdf`}>Download receipt (PDF)</DownloadPdfButton>
          {r.inv && <Link href={`/i/${r.inv.publicToken}`} className={buttonClass("ghost", "md")}>View invoice {r.inv.number}</Link>}
        </div>
      </main>
    </div>
  );
}
