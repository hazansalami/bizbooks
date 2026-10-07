import { CheckCircle2 } from "lucide-react";
import type { Receipt } from "@/lib/receipts";
import { amountInWords, money, naira } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";
import { showsBranding } from "@/lib/plan";
import { APP_NAME, PAYMENT_METHODS, TRIAL } from "@/lib/constants";
import { shade, textOn } from "@/lib/invoice-templates";

/**
 * A payment receipt, in the business's colours: who paid, how much, for what, and what's still owed.
 * Laid out like the invoices (same `print-sheet` and `doc:` rules), so it saves to PDF the same way.
 */
export function ReceiptDocument({ r }: { r: Receipt }) {
  const { p, inv, b, paidBefore, balanceAfter, due } = r;
  const color = b.brandColor || "#0E7A55";
  const ink = textOn(color);
  const cur = inv?.currency || "NGN";
  const m = (n: number) => money(n, cur);
  const paidInFull = !!inv && balanceAfter <= 0.005;
  const fromLines = [b.address, [b.city, b.state].filter(Boolean).join(", "), b.phone, b.email].filter(Boolean) as string[];
  const ids = [b.rcNumber && `${b.entityType === "BN" ? "BN" : "RC"} ${b.rcNumber}`, b.tin && `TIN ${b.tin}`].filter(Boolean).join(" · ");
  const method = PAYMENT_METHODS[p.method] ?? p.method.replace("_", " ").toLowerCase();
  const forWhat = inv?.title?.trim() || null;

  return (
    <article className="print-sheet relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 doc:px-10" style={{ background: color, color: ink }}>
        <div className="flex min-w-0 items-center gap-3">
          {b.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logo} alt={`${b.name} logo`} className="max-h-14 max-w-36 rounded-lg bg-white object-contain p-1.5" />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-lg font-bold" style={{ color }}>{initials(b.name)}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{b.name}</p>
            {b.legalName && b.legalName !== b.name && <p className="truncate text-sm opacity-80">{b.legalName}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Receipt</p>
          <p className="num text-xl font-bold">{p.receiptNumber}</p>
        </div>
      </header>

      <div className="px-6 py-7 doc:px-10 doc:py-9">
        <div className="grid gap-6 doc:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Received from</p>
            <p className="mt-1 text-lg font-semibold">{inv?.customer.name ?? "Customer"}</p>
            {inv?.customer.email && <p className="text-sm text-muted">{inv.customer.email}</p>}
            {inv?.customer.address && <p className="text-sm text-muted">{inv.customer.address}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm doc:justify-self-end">
            <dt className="text-muted">Date received</dt><dd className="font-medium">{formatDate(p.paidAt)}</dd>
            <dt className="text-muted">Paid by</dt><dd className="font-medium">{method}</dd>
            {p.reference && <><dt className="text-muted">Reference</dt><dd className="num break-all font-medium">{p.reference}</dd></>}
            {inv && <><dt className="text-muted">For invoice</dt><dd className="num font-medium">{inv.number}</dd></>}
          </dl>
        </div>

        <div className="relative mt-8 rounded-2xl px-6 py-6" style={{ background: `${color}14` }}>
          <p className="text-sm font-semibold" style={{ color: shade(color, 0.25) }}>Amount received</p>
          <p className="num mt-1 text-4xl font-bold tracking-tight doc:text-5xl">{m(p.amount)}</p>
          {cur !== "NGN" && <p className="num mt-1 text-sm text-muted">≈ {naira(p.amount * p.exchangeRate)} at ₦{p.exchangeRate.toLocaleString("en-NG")}</p>}
          <p className="mt-2 text-sm italic text-ink-soft">{amountInWords(p.amount, cur)}</p>
          {paidInFull && (
            <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ background: color, color: ink }}>
              <CheckCircle2 className="size-4" aria-hidden /> Paid in full
            </span>
          )}
        </div>

        {inv && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Payment for</h2>
            <p className="mt-1 font-semibold">Invoice {inv.number}{forWhat ? `: ${forWhat}` : ""}</p>
            <p className="text-sm text-muted">Issued {formatDate(inv.issueDate)}</p>
            <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
              <Row label="Invoice total" value={m(inv.total)} />
              {inv.whtAmount > 0 && <Row label="Withholding tax deducted by you" value={`−${m(inv.whtAmount)}`} />}
              {paidBefore > 0.005 && <Row label="Paid before this receipt" value={`−${m(paidBefore)}`} />}
              <Row label="This payment" value={`−${m(p.amount)}`} />
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-semibold">{paidInFull ? "Balance" : "Balance still due"}</dt>
                <dd className={cn("num text-base font-bold", !paidInFull && "text-ink")} style={paidInFull ? { color: shade(color, 0.25) } : undefined}>
                  {paidInFull ? "Nothing to pay" : m(balanceAfter)}
                </dd>
              </div>
            </dl>
            {due <= 0 && <p className="mt-2 text-xs text-muted">This invoice had nothing to pay.</p>}
          </section>
        )}

        {p.note && !p.note.startsWith("From bank statement") && <p className="mt-6 whitespace-pre-line text-sm text-ink-soft">{p.note}</p>}

        <div aria-hidden className="relative my-8 border-t-2 border-dashed border-line">
          <span className="absolute -left-9 -top-3 size-6 rounded-full border border-line bg-canvas doc:-left-[3.25rem]" />
          <span className="absolute -right-9 -top-3 size-6 rounded-full border border-line bg-canvas doc:-right-[3.25rem]" />
        </div>

        <footer className="grid gap-4 text-sm doc:grid-cols-[1fr_auto] doc:items-end">
          <div>
            <p className="text-base font-semibold" style={{ color: shade(color, 0.25) }}>Thank you for your payment.</p>
            <p className="mt-1 text-muted">Issued by {b.legalName || b.name}{ids ? ` · ${ids}` : ""}</p>
            {fromLines.length > 0 && <p className="text-muted">{fromLines.filter((l) => l !== b.email).join(" · ")}</p>}
          </div>
          <p className="text-xs text-muted doc:text-right">Keep this receipt for your records.{(b.email || b.phone) && <><br />Questions? {b.email || b.phone}</>}</p>
        </footer>

        {showsBranding(b) && (
          <p className="mt-8 text-center text-xs text-muted">
            Receipt by <a href={b.referralCode ? `/r/${b.referralCode}?src=receipt` : "/signup"} className="font-semibold text-brand-deep hover:underline">{APP_NAME}</a>
            {" · "}Invoices, receipts &amp; payroll for Nigerian businesses. {TRIAL.referredDays} days of Pro free.
          </p>
        )}
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}
