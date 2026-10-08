import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { whtDeductions, type Deduction } from "@/lib/wht";
import { naira } from "@/lib/money";
import { cn, formatDate, whatsappLink } from "@/lib/utils";
import { deleteWhtCredit, matchWhtCredit, setWhtTracking } from "@/app/actions/wht";
import { Badge, ButtonLink, buttonClass, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { ChaseButton, CreditForm, CreditUpload } from "@/components/wht-bits";

export const metadata = { title: "WHT credits" };

const STATUS = {
  MISSING: { text: "Missing", tone: "danger" as const },
  WAITING: { text: "Waiting", tone: "neutral" as const },
  CREDITED: { text: "Credited", tone: "brand" as const },
};

function Intro() {
  return (
    <>
      <PageHeader title="WHT credits" description="Recover the withholding tax your clients deduct from your invoices." />
      <Panel className="max-w-2xl p-6">
        <h2 className="text-xl">Get back the 5–10% your clients keep</h2>
        <div className="mt-3 space-y-3 text-ink-soft">
          <p>When a client deducts withholding tax from your invoice, that money only counts against your company income tax if they remit it to the tax office under your TIN. Many don&apos;t, or do it late, and the credit is lost.</p>
          <p>Turn this on and BizBooks will:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>list every WHT deduction on your paid invoices</li>
            <li>match them against the credit list you download from TaxPro-Max</li>
            <li>flag the ones still missing after the remittance deadline, and help you ask the client for the credit note</li>
            <li>keep a running total of credits you can use when you file, with a CSV for your accountant</li>
          </ul>
          <p className="text-sm text-muted">Nothing is sent to your clients unless you press the button to ask them. You can turn it off any time.</p>
        </div>
        <form action={setWhtTracking} className="mt-5">
          <input type="hidden" name="on" value="1" />
          <button className={buttonClass("primary")}>Turn on WHT tracking</button>
        </form>
      </Panel>
    </>
  );
}

function Row({ d, tin }: { d: Deduction; tin: string | null }) {
  const message = `Hello, thank you for paying invoice ${d.number}. ${naira(d.amount)} withholding tax was deducted from the payment and we can't yet see it remitted under our TIN${tin ? ` (${tin})` : ""}. Could you send the WHT credit note or receipt? Thank you.`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <Link href={`/app/invoices/${d.invoiceId}`} className="hover:underline">{d.number}</Link> · {d.customerName}
        </p>
        <p className="text-sm text-muted">
          Paid {formatDate(d.paidAt)}
          {d.status === "WAITING" && ` · credit expected by ${formatDate(d.expectedBy)}`}
          {d.status === "MISSING" && ` · was due by ${formatDate(d.expectedBy)}`}
          {d.chasedAt && ` · asked ${formatDate(d.chasedAt)}`}
        </p>
      </div>
      <span className="num font-semibold">{naira(d.amount)}</span>
      <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].text}</Badge>
      {d.status !== "CREDITED" && (
        <div className="flex flex-wrap items-start gap-2">
          {d.customerEmail && <ChaseButton invoiceId={d.invoiceId} />}
          <a href={whatsappLink(d.customerPhone, message)} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>WhatsApp</a>
        </div>
      )}
    </li>
  );
}

export default async function Wht({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { business } = await requireBusiness();
  if (!business.whtTracking) return <Intro />;

  const thisYear = new Date().getFullYear();
  const { year: y } = await searchParams;
  const year = y && /^\d{4}$/.test(y) && +y <= thisYear && +y >= thisYear - 5 ? +y : null;
  const since = year ? new Date(year, 0, 1) : new Date(thisYear - 2, 0, 1);
  const until = year ? new Date(year + 1, 0, 1) : null;

  const all = (await whtDeductions(business.id, since)).filter((d) => !until || d.paidAt < until);
  const [unmatched, creditedSum] = await Promise.all([
    db.whtCredit.findMany({ where: { businessId: business.id, invoiceId: null }, orderBy: { date: "desc" }, take: 200 }),
    db.whtCredit.aggregate({ where: { businessId: business.id, date: { gte: since, ...(until ? { lt: until } : {}) } }, _sum: { amount: true }, _count: true }),
  ]);
  const sum = (s: Deduction["status"]) => all.filter((d) => d.status === s).reduce((t, d) => t + d.amount, 0);
  const deducted = all.reduce((t, d) => t + d.amount, 0);
  const missing = all.filter((d) => d.status === "MISSING");
  const waiting = all.filter((d) => d.status === "WAITING");
  const credited = all.filter((d) => d.status === "CREDITED");
  const openInvoices = all.filter((d) => d.status !== "CREDITED").map((d) => ({ id: d.invoiceId, label: `${d.number} · ${d.customerName} · ${naira(d.amount)}` }));

  return (
    <>
      <PageHeader
        title="WHT credits"
        description="Withholding tax your clients deducted, and whether it reached your TIN on TaxPro-Max."
        actions={<ButtonLink href={`/app/wht/export${year ? `?year=${year}` : ""}`} variant="secondary" size="sm">Download CSV</ButtonLink>}
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[null, thisYear, thisYear - 1, thisYear - 2].map((yr) => (
          <Link key={yr ?? "all"} href={yr ? `/app/wht?year=${yr}` : "/app/wht"} className={cn("rounded-full border px-3 py-1 font-semibold", yr === year ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink")}>
            {yr ?? "Last 3 years"}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Deducted by clients" value={naira(deducted)} hint={`${all.length} invoice${all.length === 1 ? "" : "s"}`} />
        <Stat label="Credited to your TIN" value={naira(sum("CREDITED"))} tone="brand" hint="Use against company income tax" />
        <Stat label="Waiting" value={naira(sum("WAITING"))} hint="Still within the remittance window" />
        <Stat label="Missing" value={naira(sum("MISSING"))} tone={missing.length ? "danger" : "neutral"} hint={missing.length ? `${missing.length} to chase` : "Nothing to chase"} />
      </div>

      {missing.length > 0 && (
        <Notice tone="sun" className="mt-5" title={`${naira(sum("MISSING"))} of withholding tax hasn't reached your TIN`}>
          Clients must remit WHT by the 21st of the month after they pay you. Ask them for the credit note or receipt; once you have it, upload your latest TaxPro-Max list or add it below.
        </Notice>
      )}

      <Panel className="mt-5 p-5">
        <h2 className="text-lg">Upload your TaxPro-Max credit list</h2>
        <p className="mb-3 mt-1 text-sm text-muted">On TaxPro-Max, open your WHT credit notes (or WHT transactions) list, export it, and save it as CSV. Upload it here as often as you like: credits already here are skipped.</p>
        <CreditUpload />
      </Panel>

      {[{ title: "Missing", list: missing }, { title: "Waiting", list: waiting }, { title: "Credited", list: credited }].map(({ title, list }) =>
        list.length ? (
          <section key={title} className="mt-8">
            <h2 className="mb-3 text-lg">{title} <span className="text-muted">({list.length})</span></h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
              {list.map((d) => <Row key={d.invoiceId} d={d} tin={business.tin} />)}
            </ul>
          </section>
        ) : null,
      )}
      {!all.length && (
        <p className="mt-8 text-muted">No paid invoices with withholding tax {year ? `in ${year}` : "yet"}. When a client deducts WHT, record the payment with the WHT amount on the invoice and it shows here.</p>
      )}

      {unmatched.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg">Credits not linked to an invoice <span className="text-muted">({unmatched.length})</span></h2>
          <p className="mb-3 text-sm text-muted">These still count towards your tax credit. Link one to an invoice if you know which it covers.</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
            {unmatched.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.payerName}</p>
                  <p className="text-sm text-muted">{formatDate(c.date)}{c.reference ? ` · ${c.reference}` : ""}{c.source === "MANUAL" ? " · added by hand" : ""}</p>
                </div>
                <span className="num font-semibold">{naira(c.amount)}</span>
                {openInvoices.length > 0 && (
                  <form action={matchWhtCredit} className="flex items-center gap-2">
                    <input type="hidden" name="creditId" value={c.id} />
                    <select name="invoiceId" aria-label="Invoice this credit covers" className="max-w-56 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm">
                      {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                    </select>
                    <button className={buttonClass("secondary", "sm")}>Link</button>
                  </form>
                )}
                <form action={deleteWhtCredit}>
                  <input type="hidden" name="creditId" value={c.id} />
                  <ConfirmButton message="Remove this credit?" className="text-xs font-semibold text-muted underline hover:text-danger">Remove</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Panel className="mt-8 p-5">
        <h2 className="text-lg">Add a credit by hand</h2>
        <p className="mb-3 mt-1 text-sm text-muted">For a credit note or remittance receipt a client sent you.</p>
        <CreditForm invoices={openInvoices} />
      </Panel>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>{creditedSum._count} credit{creditedSum._count === 1 ? "" : "s"} on file for this period, {naira(creditedSum._sum.amount ?? 0)} in total.</p>
        <form action={setWhtTracking}>
          <input type="hidden" name="on" value="0" />
          <ConfirmButton message="Turn off WHT tracking? Your credits stay saved; the page just hides." className="font-semibold underline hover:text-ink">Turn off WHT tracking</ConfirmButton>
        </form>
      </div>
    </>
  );
}
