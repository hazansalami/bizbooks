import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clientStatement, isStatementPeriod } from "@/lib/client-statement";
import { DownloadPdfButton } from "@/components/pdf-download";
import { StatementDocument } from "@/components/statement-document";

export const metadata: Metadata = { title: "Statement of account", robots: { index: false, follow: false } };

/** A client's statement of account, by private link. Always current: it's worked out when it's opened. */
export default async function PublicStatement({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ period?: string; currency?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const c = await db.customer.findUnique({ where: { statementToken: token }, select: { id: true, businessId: true } });
  if (!c) notFound();
  const [s, b] = await Promise.all([
    clientStatement(c.businessId, c.id, { period: isStatementPeriod(sp.period) ? sp.period : "all", currency: sp.currency }),
    db.business.findUniqueOrThrow({ where: { id: c.businessId }, include: { bankAccounts: true } }),
  ]);
  if (!s) notFound();
  return (
    <div className="min-h-dvh bg-canvas">
      <main className="mx-auto max-w-3xl space-y-4 px-3 py-6 doc:px-6 doc:py-10">
        <StatementDocument b={b} s={s} />
        <div className="no-print flex justify-center">
          <DownloadPdfButton filename={`Statement of account from ${b.name}.pdf`}>Download statement (PDF)</DownloadPdfButton>
        </div>
      </main>
    </div>
  );
}
