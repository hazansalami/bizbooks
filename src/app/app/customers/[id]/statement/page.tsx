import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientStatement, isStatementPeriod, STATEMENT_PERIODS, statementToken, statementUrl, type StatementPeriod } from "@/lib/client-statement";
import { money } from "@/lib/money";
import { cn, greetingName, whatsappLink } from "@/lib/utils";
import { buttonClass, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/form-bits";
import { DownloadPdfButton } from "@/components/pdf-download";
import { StatementDocument } from "@/components/statement-document";
import { EmailStatement } from "@/components/statement-bits";

export const metadata = { title: "Statement of account" };

export default async function Statement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; currency?: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const sp = await searchParams;
  const period: StatementPeriod = isStatementPeriod(sp.period) ? sp.period : "all";
  const s = await clientStatement(business.id, id, { period, currency: sp.currency });
  if (!s) notFound();
  const b = await db.business.findUniqueOrThrow({ where: { id: business.id }, include: { bankAccounts: true } });
  const link = statementUrl(await statementToken(id), period, s.currency);
  const href = (p: StatementPeriod, cur = s.currency) => {
    const q = new URLSearchParams();
    if (p !== "all") q.set("period", p);
    if (cur !== "NGN" && s.currencies.length > 1) q.set("currency", cur);
    const qs = q.toString();
    return `/app/customers/${id}/statement${qs ? `?${qs}` : ""}`;
  };
  const pill = (on: boolean) => cn("rounded-full border px-3 py-1 text-sm font-semibold", on ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink");
  const owing = s.outstanding > 0.005 ? `. The balance outstanding is ${money(s.outstanding, s.currency)}` : "";
  const message = `Hello ${greetingName(s.customer.name)}, here is your statement of account from ${business.name}${owing}: ${link}`;

  return (
    <>
      <PageHeader
        title="Statement of account"
        back={{ href: `/app/customers/${id}`, label: s.customer.name }}
        description="Every invoice and payment for this client, with a running balance. Share it before their payment run, or whenever they ask what they owe."
      />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {(Object.keys(STATEMENT_PERIODS) as StatementPeriod[]).map((p) => <Link key={p} href={href(p)} className={pill(p === period)}>{STATEMENT_PERIODS[p]}</Link>)}
        {s.currencies.length > 1 && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
        {s.currencies.length > 1 && s.currencies.map((c) => <Link key={c} href={href(period, c)} className={pill(c === s.currency)}>{c}</Link>)}
      </div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <DownloadPdfButton filename={`${s.customer.name} statement from ${business.name}.pdf`} className={buttonClass("primary", "sm")} />
        {s.customer.email && <EmailStatement customerId={id} period={period} currency={s.currency} email={s.customer.email} />}
        <a href={whatsappLink(s.customer.phone, message)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>
        <CopyButton text={link} label="Copy link" className={buttonClass("ghost", "sm")} />
      </div>
      <StatementDocument b={b} s={s} />
    </>
  );
}
