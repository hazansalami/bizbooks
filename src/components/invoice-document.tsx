import type { FullInvoice } from "@/lib/invoices";
import { amountInWords, balanceDue, naira } from "@/lib/money";
import { formatDate, initials } from "@/lib/utils";
import { isPro } from "@/lib/plan";
import { APP_NAME } from "@/lib/constants";

/** The invoice itself, as the customer sees and prints it. */
export function InvoiceDocument({ inv }: { inv: FullInvoice }) {
  const b = inv.business;
  const color = b.brandColor || "#0E7A55";
  const isQuote = inv.kind === "QUOTE";
  const due = balanceDue(inv);
  const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const banks = [...b.bankAccounts].sort((x, y) => Number(y.isDefault) - Number(x.isDefault));

  return (
    <article className="print-sheet relative overflow-hidden rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-10">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
      {inv.status === "PAID" && (
        <span aria-hidden className="absolute right-6 top-24 rotate-[-12deg] rounded-lg border-4 border-brand/70 px-3 py-1 text-2xl font-black tracking-widest text-brand/70 sm:right-12">PAID</span>
      )}

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {b.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logo} alt={`${b.name} logo`} className="max-h-16 max-w-40 object-contain" />
          ) : (
            <span className="grid size-14 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: color }}>{initials(b.name)}</span>
          )}
          <div className="text-sm">
            <p className="text-base font-bold">{b.name}</p>
            {b.legalName && b.legalName !== b.name && <p className="text-muted">{b.legalName}</p>}
            {[b.address, [b.city, b.state].filter(Boolean).join(", "), b.phone, b.email].filter(Boolean).map((l) => <p key={l!} className="text-muted">{l}</p>)}
            {(b.rcNumber || b.tin) && <p className="text-muted">{[b.rcNumber && `${b.entityType === "BN" ? "BN" : "RC"} ${b.rcNumber}`, b.tin && `TIN ${b.tin}`].filter(Boolean).join(" · ")}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold uppercase tracking-wide" style={{ color }}>{isQuote ? "Quote" : "Invoice"}</p>
          <p className="num font-semibold">{inv.number}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{isQuote ? "Prepared for" : "Bill to"}</p>
          <p className="mt-1 text-base font-semibold">{inv.customer.name}</p>
          {inv.customer.contactName && <p className="text-muted">Attn: {inv.customer.contactName}</p>}
          {[inv.customer.address, inv.customer.email].filter(Boolean).map((l) => <p key={l!} className="text-muted">{l}</p>)}
          {inv.customer.tin && <p className="text-muted">TIN {inv.customer.tin}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-muted">Date</dt><dd className="text-right font-medium">{formatDate(inv.issueDate)}</dd>
          <dt className="text-muted">{isQuote ? "Valid until" : "Due"}</dt><dd className="text-right font-medium">{formatDate(inv.dueDate)}</dd>
          {inv.poNumber && <><dt className="text-muted">PO / ref</dt><dd className="text-right font-medium">{inv.poNumber}</dd></>}
          {!isQuote && <><dt className="text-muted">Amount due</dt><dd className="num text-right font-bold">{naira(due)}</dd></>}
        </dl>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b-2 text-left text-xs uppercase tracking-wider text-muted" style={{ borderColor: color }}>
              <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
              <th scope="col" className="w-16 py-2 text-right font-semibold">Qty</th>
              <th scope="col" className="w-28 py-2 text-right font-semibold">Price</th>
              <th scope="col" className="w-32 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id} className="border-b border-line align-top">
                <td className="py-3 pr-2">{it.description}</td>
                <td className="num py-3 text-right">{qty(it.quantity)}</td>
                <td className="num py-3 text-right">{naira(it.unitPrice)}</td>
                <td className="num py-3 text-right font-medium">{naira(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <dl className="num w-full max-w-xs space-y-1.5 text-sm">
          <Row label="Subtotal" value={naira(inv.subtotal)} />
          {inv.discount > 0 && <Row label="Discount" value={`−${naira(inv.discount)}`} />}
          {inv.vatRate > 0 && <Row label={`VAT (${inv.vatRate}%)`} value={naira(inv.vatAmount)} />}
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{naira(inv.total)}</dd></div>
          {inv.whtRate > 0 && <Row label={`Less WHT (${inv.whtRate}%) deducted by you`} value={`−${naira(inv.whtAmount)}`} />}
          {inv.amountPaid > 0 && <Row label="Paid so far" value={`−${naira(inv.amountPaid)}`} />}
          {!isQuote && (inv.whtRate > 0 || inv.amountPaid > 0) && (
            <div className="flex justify-between rounded-lg px-2 py-1.5 font-bold text-white" style={{ background: color }}><dt>Balance due</dt><dd>{naira(due)}</dd></div>
          )}
        </dl>
      </div>
      <p className="mt-3 text-right text-xs italic text-muted">{amountInWords(isQuote ? inv.total : due || inv.total)}</p>

      {!isQuote && banks.length > 0 && (
        <div className="mt-8 rounded-xl bg-canvas p-4 text-sm">
          <p className="font-semibold">Pay by bank transfer</p>
          {banks.map((a) => (
            <p key={a.id} className="mt-1"><span className="text-muted">{a.bankName}:</span> <span className="num font-semibold">{a.accountNumber}</span> · {a.accountName}</p>
          ))}
          <p className="mt-1 text-muted">Please use <strong className="text-ink">{inv.number}</strong> as your transfer narration.</p>
        </div>
      )}

      {(inv.notes || b.invoiceFooter) && (
        <div className="mt-6 space-y-2 whitespace-pre-line text-sm text-ink-soft">
          {inv.notes && <p>{inv.notes}</p>}
          {b.invoiceFooter && <p>{b.invoiceFooter}</p>}
        </div>
      )}
      {!isPro(b) && <p className="mt-8 text-center text-xs text-muted">Created with {APP_NAME}, free invoicing for Nigerian businesses</p>}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-ink-soft"><dt>{label}</dt><dd>{value}</dd></div>;
}
