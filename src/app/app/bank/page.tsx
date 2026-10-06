import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Landmark, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { guessCategory } from "@/lib/bank";
import { monoConfigured } from "@/lib/mono";
import { balanceDue, naira } from "@/lib/money";
import { EXPENSE_CATEGORIES, PAYROLL_CATEGORIES } from "@/lib/constants";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { confirmBankSuggestion, connectBank, disconnectBank, ignoreAllBankLines, ignoreBankLine, reopenBankLine, syncBankNow } from "@/app/actions/bank";
import { buttonClass, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { LineToExpense, LineToPayment, StatementUpload } from "@/components/bank-bits";

export const metadata = { title: "Bank" };

const TABS = { review: "To review", done: "Matched", ignored: "Ignored" } as const;
type Tab = keyof typeof TABS;

export default async function Bank({ searchParams }: { searchParams: Promise<{ show?: string; linked?: string }> }) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const tab: Tab = sp.show && sp.show in TABS ? (sp.show as Tab) : "review";
  const base = { businessId: business.id };
  // A line matched to a payment or expense that was later deleted needs sorting again.
  const reviewWhere = { ...base, OR: [{ status: "UNMATCHED" }, { status: "MATCHED", paymentId: null, expenseId: null }] };
  const where = tab === "review" ? reviewWhere : tab === "done" ? { ...base, status: "MATCHED", OR: [{ paymentId: { not: null } }, { expenseId: { not: null } }] } : { ...base, status: "IGNORED" };

  const [lines, counts, connections, openInvoices, bills, accounts, lastBalance] = await Promise.all([
    db.bankTransaction.findMany({
      where, orderBy: { date: "desc" }, take: 200,
      include: { payment: { select: { invoice: { select: { id: true, number: true } } } }, expense: { select: { id: true, category: true } } },
    }),
    Promise.all([db.bankTransaction.count({ where: reviewWhere }), db.bankTransaction.count({ where: { ...base, status: "MATCHED" } }), db.bankTransaction.count({ where: { ...base, status: "IGNORED" } })]),
    db.bankConnection.findMany({ where: { ...base, status: { not: "PENDING" } }, orderBy: { createdAt: "asc" } }),
    db.invoice.findMany({ where: { ...base, kind: "INVOICE", currency: "NGN", status: { in: ["SENT", "PARTIAL"] } }, include: { customer: { select: { name: true } } }, orderBy: { dueDate: "asc" }, take: 300 }),
    db.expense.findMany({ where: { ...base, paid: false }, select: { id: true, vendor: true, category: true, amount: true } }),
    db.bankTransaction.findMany({ where: { ...base, account: { not: null } }, distinct: ["account"], select: { account: true }, take: 10 }),
    db.bankTransaction.findFirst({ where: { ...base, balance: { not: null } }, orderBy: { date: "desc" }, select: { balance: true, date: true } }),
  ]);
  const [toReview, matched, ignored] = counts;
  const invoiceById = new Map(openInvoices.map((i) => [i.id, i]));
  const billById = new Map(bills.map((b) => [b.id, b]));
  const invoiceOptions = openInvoices.map((i) => ({ id: i.id, label: `${i.number} · ${i.customer.name} · ${naira(balanceDue(i))}` }));
  const categories = EXPENSE_CATEGORIES.filter((c) => !PAYROLL_CATEGORIES.includes(c));
  const live = connections.filter((c) => c.status !== "DISCONNECTED");
  const total = toReview + matched + ignored;
  const oldest = tab === "review" && lines.length ? lines[lines.length - 1].date : null;

  return (
    <>
      <PageHeader title="Bank" description="Bring in your bank statement and BizBooks matches each line to your invoices and expenses. What's left takes a tap each." />

      {sp.linked && <Notice tone="brand" className="mb-5" title="Bank account linked">Transactions arrive within a few minutes. Refresh this page to see them.</Notice>}

      {total > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="To review" value={String(toReview)} tone={toReview ? "sun" : "brand"} hint={toReview ? "Lines not yet in your books" : "All sorted"} />
          <Stat label="Matched" value={String(matched)} tone="brand" hint="Linked to a payment or expense" />
          {lastBalance && <Stat label="Balance on statement" value={naira(lastBalance.balance!)} hint={`On ${formatDate(lastBalance.date)}, now used by the cash forecast`} />}
        </div>
      )}

      <Panel className="p-5">
        <h2 className="text-lg">{total ? "Upload another statement" : "Upload a bank statement"}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">From your bank&apos;s internet banking or app, download the statement as CSV (if it gives you Excel, open it and save as CSV). Lines you&apos;ve already imported are skipped, so overlapping dates are fine.</p>
        <StatementUpload accounts={accounts.map((a) => a.account!).filter(Boolean)} />
      </Panel>

      {(monoConfigured() || live.length > 0) && (
        <Panel className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-2 text-lg"><Landmark className="size-5 text-brand" aria-hidden />Automatic bank feed</h2>
              <p className="mt-1 text-sm text-muted">Link your account once (through Mono, read-only: it can&apos;t move money) and new lines arrive every day with no uploading.</p>
            </div>
            {monoConfigured() && <form action={connectBank}><button className={buttonClass(live.length ? "secondary" : "primary", "sm")}>{live.length ? "Link another account" : "Link a bank account"}</button></form>}
          </div>
          {live.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {live.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="flex-1 font-semibold">{c.label ?? "Bank account"}</span>
                  <span className={cn("text-muted", c.status === "REAUTH" && "font-semibold text-danger")}>
                    {c.status === "REAUTH" ? "Needs reconnecting" : c.lastSyncedAt ? `Updated ${timeAgo(c.lastSyncedAt)}` : "Waiting for first sync"}
                  </span>
                  {c.status === "ACTIVE" && <form action={syncBankNow}><input type="hidden" name="id" value={c.id} /><button className={buttonClass("ghost", "sm")}><RefreshCw className="size-4" aria-hidden /> Sync now</button></form>}
                  {c.status === "REAUTH" && monoConfigured() && <form action={connectBank}><button className={buttonClass("secondary", "sm")}>Reconnect</button></form>}
                  <form action={disconnectBank}><input type="hidden" name="id" value={c.id} />
                    <ConfirmButton message="Unlink this account? Lines already imported stay." className="text-xs font-semibold text-muted underline hover:text-danger">Unlink</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {total > 0 && (
        <>
          <div className="mb-3 mt-8 flex flex-wrap items-center gap-2 text-sm">
            {(Object.keys(TABS) as Tab[]).map((k) => (
              <Link key={k} href={k === "review" ? "/app/bank" : `/app/bank?show=${k}`} className={cn("rounded-full border px-3 py-1 font-semibold", k === tab ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink")}>
                {TABS[k]} ({k === "review" ? toReview : k === "done" ? matched : ignored})
              </Link>
            ))}
          </div>

          {lines.length === 0 ? (
            <p className="text-muted">{tab === "review" ? "Nothing to review. Every line is in your books." : "Nothing here."}</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
              {lines.map((t) => {
                const inflow = t.amount > 0;
                const inv = t.suggestedId && inflow ? invoiceById.get(t.suggestedId) : undefined;
                const bill = t.suggestedId && !inflow ? billById.get(t.suggestedId) : undefined;
                return (
                  <li key={t.id} className="p-4">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                      {inflow ? <ArrowDownLeft className="mt-0.5 size-5 shrink-0 text-brand" aria-label="Money in" /> : <ArrowUpRight className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-label="Money out" />}
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium">{t.description}</p>
                        <p className="text-sm text-muted">{formatDate(t.date)}{t.account ? ` · ${t.account}` : ""}{t.source === "MONO" ? " · bank feed" : ""}</p>
                      </div>
                      <span className={cn("num font-semibold", inflow ? "text-brand-deep" : "text-ink")}>{inflow ? "+" : "−"}{naira(Math.abs(t.amount))}</span>
                    </div>

                    {tab === "review" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pl-9">
                        {inv && (
                          <form action={confirmBankSuggestion}><input type="hidden" name="id" value={t.id} />
                            <button className={buttonClass("primary", "sm")}>Payment for {inv.number} ({inv.customer.name})</button>
                          </form>
                        )}
                        {bill && (
                          <form action={confirmBankSuggestion}><input type="hidden" name="id" value={t.id} />
                            <button className={buttonClass("primary", "sm")}>Pays bill: {bill.vendor ?? bill.category}</button>
                          </form>
                        )}
                        {inflow ? <LineToPayment id={t.id} invoices={invoiceOptions} /> : <LineToExpense id={t.id} categories={categories} guess={guessCategory(t.description)} />}
                        <form action={ignoreBankLine}><input type="hidden" name="id" value={t.id} />
                          <button className={buttonClass("ghost", "sm")} title="Transfers between your own accounts, loans, owner top-ups">Not business income or spending</button>
                        </form>
                      </div>
                    )}
                    {tab === "done" && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 pl-9 text-sm text-muted">
                        {t.payment?.invoice ? <span>Payment on <Link href={`/app/invoices/${t.payment.invoice.id}`} className="font-semibold text-brand hover:underline">{t.payment.invoice.number}</Link></span>
                          : t.expense ? <span>Expense: <Link href={`/app/expenses/${t.expense.id}`} className="font-semibold text-brand hover:underline">{t.expense.category}</Link></span> : null}
                        <form action={reopenBankLine}><input type="hidden" name="id" value={t.id} /><button className="text-xs font-semibold underline hover:text-ink">Unlink</button></form>
                      </div>
                    )}
                    {tab === "ignored" && (
                      <form action={reopenBankLine} className="mt-2 pl-9"><input type="hidden" name="id" value={t.id} /><button className="text-xs font-semibold text-muted underline hover:text-ink">Move back to review</button></form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "review" && toReview > 20 && oldest && (
            <form action={ignoreAllBankLines} className="mt-4 text-sm text-muted">
              Old history you don&apos;t need in your books?{" "}
              <ConfirmButton message={`Move all ${toReview} lines still to review to Ignored? You can bring any back later.`} className="font-semibold underline hover:text-ink">Ignore everything still to review</ConfirmButton>
            </form>
          )}
        </>
      )}
    </>
  );
}
