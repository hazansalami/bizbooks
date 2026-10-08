import Link from "next/link";
import { CheckCircle2, Circle, Download, FileText } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { complianceScore, DOC_KINDS, docStatus, type DocKind } from "@/lib/compliance";
import { cn, formatDate } from "@/lib/utils";
import { deleteDocument, setComplianceTracking } from "@/app/actions/compliance";
import { Badge, buttonClass, Notice, PageHeader, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { DocumentUpload } from "@/components/compliance-bits";

export const metadata = { title: "Compliance" };

const STATUS = {
  VALID: { text: "Valid", tone: "brand" as const },
  EXPIRING: { text: "Expires soon", tone: "sun" as const },
  EXPIRED: { text: "Expired", tone: "danger" as const },
  NO_EXPIRY: { text: "On file", tone: "neutral" as const },
};

function Intro() {
  return (
    <>
      <PageHeader title="Compliance" description="Your company papers in one place, ready for the next vendor form." />
      <Panel className="max-w-2xl p-6">
        <h2 className="text-xl">Be the supplier that's ready on day one</h2>
        <div className="mt-3 space-y-3 text-ink-soft">
          <p>Banks, oil and gas companies, multinationals and government agencies ask every supplier for the same papers: CAC certificate, tax clearance, pension and ITF certificates. Finding them when a tender closes on Friday costs deals.</p>
          <p>Turn this on and BizBooks will:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>keep your company documents in one place</li>
            <li>warn you a month before a certificate expires</li>
            <li>score how ready you are for a vendor registration, with what to fix</li>
            <li>bundle everything into one PDF vendor pack to attach to a tender</li>
          </ul>
          <p className="text-sm text-muted">Your documents are private to your business. You can turn this off any time.</p>
        </div>
        <form action={setComplianceTracking} className="mt-5">
          <input type="hidden" name="on" value="1" />
          <button className={buttonClass("primary")}>Turn on compliance tracking</button>
        </form>
      </Panel>
    </>
  );
}

export default async function Compliance() {
  const { business } = await requireBusiness();
  if (!business.complianceTracking) return <Intro />;
  const { score, checks, docs } = await complianceScore(business);
  const todo = checks.filter((c) => !c.done);
  const expiring = docs.filter((d) => ["EXPIRING", "EXPIRED"].includes(docStatus(d.expiresAt)));
  const kinds = Object.entries(DOC_KINDS).map(([key, k]) => ({ key, ...k }));
  const nextKind = (["CAC_CERT", "TCC", "CAC_STATUS", "PENCOM"] as DocKind[]).find((k) => !docs.some((d) => d.kind === k));
  const tone = score >= 80 ? "text-brand-deep" : score >= 50 ? "text-sun-ink" : "text-danger";

  return (
    <>
      <PageHeader
        title="Compliance"
        description="Your company papers, what's expiring, and how ready you are for a vendor registration."
        actions={docs.length > 0 && <a href="/app/compliance/pack" className={buttonClass("primary", "sm")}><Download className="size-4" aria-hidden /> Download vendor pack</a>}
      />

      <Panel className="flex flex-wrap items-center gap-6 p-5">
        <div className="text-center">
          <p className={cn("num text-5xl font-bold tracking-tight", tone)}>{score}</p>
          <p className="text-sm text-muted">out of 100</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{score === 100 ? "Ready for any vendor registration" : score >= 80 ? "Nearly there" : score >= 50 ? "A few gaps a buyer would notice" : "Buyers would turn this down today"}</p>
          <p className="mt-1 text-sm text-ink-soft">{todo.length ? `${todo.length} thing${todo.length === 1 ? "" : "s"} to fix, below.` : "Everything a buyer usually checks is in place."}</p>
        </div>
      </Panel>

      {expiring.length > 0 && (
        <Notice tone="sun" className="mt-5" title={`${expiring.length} document${expiring.length === 1 ? "" : "s"} expired or expiring within a month`}>
          {expiring.map((d) => `${d.title} (${d.expiresAt ? formatDate(d.expiresAt) : ""})`).join(", ")}. Renew {expiring.length === 1 ? "it" : "them"} and upload the new one.
        </Notice>
      )}

      <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-paper">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 p-4">
            {c.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-line-strong" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.label}<span className="sr-only">{c.done ? " (done)" : " (to do)"}</span></p>
              <p className="text-sm text-muted">{c.detail}</p>
            </div>
            {!c.done && (c.href.startsWith("#") ? <a href={c.href} className="shrink-0 text-sm font-semibold text-brand hover:underline">Upload</a> : <Link href={c.href} className="shrink-0 text-sm font-semibold text-brand hover:underline">Fix</Link>)}
          </li>
        ))}
      </ul>

      <h2 className="mb-3 mt-8 text-lg">Documents</h2>
      {docs.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
          {docs.sort((a, b) => Object.keys(DOC_KINDS).indexOf(a.kind) - Object.keys(DOC_KINDS).indexOf(b.kind)).map((d) => {
            const st = STATUS[docStatus(d.expiresAt)];
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <FileText className="size-5 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <a href={`/app/compliance/doc/${d.id}`} target="_blank" rel="noopener" className="font-semibold hover:underline">{d.title}</a>
                  <p className="text-sm text-muted">
                    {[d.issuedAt && `Issued ${formatDate(d.issuedAt)}`, d.expiresAt && `valid until ${formatDate(d.expiresAt)}`, `${Math.max(1, Math.round(d.size / 1024))} KB`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone={st.tone}>{st.text}</Badge>
                <form action={deleteDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmButton message={`Delete ${d.title}? This can't be undone.`} className="text-xs font-semibold text-muted underline hover:text-danger">Delete</ConfirmButton>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">No documents yet. Start with your CAC certificate.</p>
      )}

      <Panel className="mt-5 scroll-mt-20 p-5" as="section">
        <h2 id="upload" className="mb-3 scroll-mt-24 text-lg">Upload a document</h2>
        <DocumentUpload kinds={kinds} suggested={nextKind} />
      </Panel>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>The vendor pack is one PDF: a cover sheet with your company details, then each current document. Expired ones are left out.</p>
        <form action={setComplianceTracking}>
          <input type="hidden" name="on" value="0" />
          <ConfirmButton message="Turn off compliance tracking? Your documents stay saved; the page just hides." className="font-semibold underline hover:text-ink">Turn off compliance tracking</ConfirmButton>
        </form>
      </div>
    </>
  );
}
