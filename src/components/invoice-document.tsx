import type { CSSProperties, ReactNode } from "react";
import type { FullInvoice } from "@/lib/invoices";
import { amountInWords, balanceDue, money } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";
import { isPro } from "@/lib/plan";
import { APP_NAME } from "@/lib/constants";
import { shade, templateId, textOn, type InvoiceTemplateId } from "@/lib/invoice-templates";

/**
 * The invoice itself, as the customer sees and prints it, in the business's chosen style.
 * `template` overrides the business setting (used by the style picker previews).
 */
export function InvoiceDocument({ inv, template }: { inv: FullInvoice; template?: InvoiceTemplateId }) {
  const d = docData(inv);
  switch (template ?? templateId(inv.business.invoiceTemplate)) {
    case "contemporary": return <Contemporary d={d} />;
    case "minimal": return <Minimal d={d} />;
    case "letterhead": return <Letterhead d={d} />;
    case "compact": return <Compact d={d} />;
    default: return <Classic d={d} />;
  }
}

type Doc = ReturnType<typeof docData>;

function docData(inv: FullInvoice) {
  const b = inv.business;
  const color = b.brandColor || "#0E7A55";
  const isQuote = inv.kind === "QUOTE";
  const kindLabel = isQuote ? "Quote" : inv.vatAmount > 0 ? "Tax invoice" : "Invoice";
  const cur = inv.currency || "NGN";
  return {
    inv, b, color, isQuote, kindLabel, cur,
    m: (n: number) => money(n, cur),
    heading: inv.title?.trim() || kindLabel,
    due: balanceDue(inv),
    banks: [...b.bankAccounts].sort((x, y) => Number(y.isDefault) - Number(x.isDefault)),
    fromLines: [b.address, [b.city, b.state].filter(Boolean).join(", "), b.phone, b.email].filter(Boolean) as string[],
    ids: [b.rcNumber && `${b.entityType === "BN" ? "BN" : "RC"} ${b.rcNumber}`, b.tin && `TIN ${b.tin}`].filter(Boolean).join(" · "),
    meta: [
      [isQuote ? "Quote no." : "Invoice no.", inv.number],
      [isQuote ? "Quote date" : "Invoice date", formatDate(inv.issueDate)],
      [isQuote ? "Valid until" : "Payment due", formatDate(inv.dueDate)],
      ...(inv.poNumber ? [["PO / ref", inv.poNumber]] : []),
    ] as [string, string][],
  };
}

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const signed = (d: Doc, n: number) => (n < 0 ? `(${d.m(-n)})` : d.m(n));

/* ---------- Shared pieces ---------- */

function Sheet({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <article className={cn("print-sheet relative overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-sm", className)} style={style}>{children}</article>;
}

function Logo({ d, size = "md" }: { d: Doc; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "max-h-10 max-w-28", md: "max-h-16 max-w-40", lg: "max-h-20 max-w-52" }[size];
  const tile = { sm: "size-10 text-sm", md: "size-14 text-lg", lg: "size-16 text-xl" }[size];
  return d.b.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={d.b.logo} alt={`${d.b.name} logo`} className={cn("object-contain", box)} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-xl font-bold", tile)} style={{ background: d.color, color: textOn(d.color) }}>{initials(d.b.name)}</span>
  );
}

function From({ d, className }: { d: Doc; className?: string }) {
  return (
    <div className={cn("text-sm", className)}>
      <p className="text-base font-bold">{d.b.name}</p>
      {d.b.legalName && d.b.legalName !== d.b.name && <p className="text-muted">{d.b.legalName}</p>}
      {d.fromLines.map((l) => <p key={l} className="text-muted">{l}</p>)}
      {d.ids && <p className="text-muted">{d.ids}</p>}
    </div>
  );
}

function BillTo({ d, label }: { d: Doc; label?: string }) {
  const c = d.inv.customer;
  return (
    <div className="text-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label ?? (d.isQuote ? "Prepared for" : "Bill to")}</p>
      <p className="mt-1 text-base font-semibold">{c.name}</p>
      {c.contactName && <p className="text-muted">Attn: {c.contactName}</p>}
      {[c.address, c.email, c.phone].filter(Boolean).map((l) => <p key={l!} className="text-muted">{l}</p>)}
      {c.tin && <p className="text-muted">TIN {c.tin}</p>}
    </div>
  );
}

function Meta({ d, withDue = true, className }: { d: Doc; withDue?: boolean; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm", className)}>
      {d.meta.map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-right font-semibold">{k}:</dt><dd className="num">{v}</dd></div>
      ))}
      {withDue && !d.isQuote && <><dt className="text-right font-semibold">Amount due:</dt><dd className="num font-bold">{d.m(d.due)}</dd></>}
    </dl>
  );
}

function ItemText({ name, details, className }: { name: string; details: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="font-semibold">{name}</p>
      {details && <p className="mt-1 whitespace-pre-line text-ink-soft">{details}</p>}
    </div>
  );
}

function Totals({ d, className, highlight = true }: { d: Doc; className?: string; highlight?: boolean }) {
  const { inv, color, isQuote, due } = d;
  return (
    <div className={cn("flex flex-col items-end", className)}>
      <dl className="num w-full max-w-xs space-y-1.5 text-sm">
        <Row label="Subtotal" value={d.m(inv.subtotal)} />
        {inv.discount > 0 && <Row label="Discount" value={`−${d.m(inv.discount)}`} />}
        {inv.vatAmount > 0 && <Row label={`VAT (${inv.vatRate}%)`} value={d.m(inv.vatAmount)} />}
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{d.m(inv.total)}</dd></div>
        {inv.whtRate > 0 && <Row label={`Less WHT (${inv.whtRate}%) deducted by you`} value={`−${d.m(inv.whtAmount)}`} />}
        {inv.amountPaid > 0 && <Row label="Paid so far" value={`−${d.m(inv.amountPaid)}`} />}
        {!isQuote && (
          highlight
            ? <div className="flex justify-between rounded-lg px-2 py-1.5 font-bold" style={{ background: color, color: textOn(color) }}><dt>Amount due ({d.cur})</dt><dd>{d.m(due)}</dd></div>
            : <div className="flex justify-between border-t-2 pt-2 text-base font-bold" style={{ borderColor: color }}><dt>Amount due ({d.cur})</dt><dd>{d.m(due)}</dd></div>
        )}
      </dl>
      <p className="mt-3 max-w-md text-right text-xs italic text-muted">{amountInWords(isQuote ? inv.total : due || inv.total, d.cur)}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-ink-soft"><dt>{label}</dt><dd>{value}</dd></div>;
}

function PayAndNotes({ d, boxed = true }: { d: Doc; boxed?: boolean }) {
  const { inv, b, banks, isQuote } = d;
  return (
    <>
      {!isQuote && banks.length > 0 && (
        <div className={cn("mt-8 text-sm", boxed ? "rounded-xl bg-canvas p-4" : "border-t border-line pt-4")}>
          <p className="font-semibold">Make payments to</p>
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
    </>
  );
}

function PaidStamp({ d, className }: { d: Doc; className?: string }) {
  if (d.inv.status !== "PAID") return null;
  return <span aria-hidden className={cn("absolute rotate-[-12deg] rounded-lg border-4 border-brand/70 px-3 py-1 text-2xl font-black tracking-widest text-brand/70", className ?? "right-6 top-24 sm:right-12")}>PAID</span>;
}

/* ---------- 1. Classic ---------- */

function Classic({ d }: { d: Doc }) {
  const { inv, color } = d;
  return (
    <Sheet className="p-5 sm:p-10">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
      <PaidStamp d={d} />
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-3"><Logo d={d} /><From d={d} /></div>
        <div className="max-w-xs text-right">
          <p className="text-2xl font-bold uppercase tracking-wide" style={{ color }}>{d.heading}</p>
          {inv.title && <p className="text-sm font-semibold uppercase tracking-wider text-muted">{d.kindLabel}</p>}
          <p className="num font-semibold">{inv.number}</p>
        </div>
      </header>
      {inv.summary && <p className="mt-6 text-ink-soft">{inv.summary}</p>}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <BillTo d={d} />
        <Meta d={d} className="sm:justify-self-end" />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
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
              <tr key={it.id} className="break-inside-avoid border-b border-line align-top">
                <td className="py-3 pr-4"><ItemText name={it.description} details={it.details} /></td>
                <td className="num py-3 text-right">{qty(it.quantity)}</td>
                <td className="num py-3 text-right">{signed(d, it.unitPrice)}</td>
                <td className="num py-3 text-right font-medium">{signed(d, it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Totals d={d} className="mt-6" />
      <PayAndNotes d={d} />
    </Sheet>
  );
}

/* ---------- 2. Contemporary (bold header band) ---------- */

function Contemporary({ d }: { d: Doc }) {
  const { inv, b, color } = d;
  const dark = shade(color);
  return (
    <Sheet>
      <header className="grid sm:grid-cols-[1fr_16rem]">
        <div className="p-6 sm:p-8" style={{ background: color, color: textOn(color) }}>
          <p className="text-2xl font-semibold uppercase leading-tight sm:text-3xl">{d.heading}{inv.title && !/invoice|quote/i.test(inv.title) ? ` ${d.kindLabel}` : ""}</p>
          {inv.summary && <p className="mt-2 text-sm opacity-90">{inv.summary}</p>}
        </div>
        <div className="flex flex-col justify-center p-6 sm:items-center sm:p-8" style={{ background: dark, color: textOn(dark) }}>
          <p className="text-sm opacity-90">{d.isQuote ? `Quote total (${d.cur})` : `Amount due (${d.cur})`}</p>
          <p className="num mt-1 text-3xl font-semibold">{d.m(d.isQuote ? inv.total : d.due)}</p>
        </div>
      </header>
      <PaidStamp d={d} className="right-6 top-40" />

      <div className="px-5 sm:px-8">
        <div className="grid gap-6 py-6 sm:grid-cols-2">
          <BillTo d={d} />
          <Meta d={d} className="sm:justify-self-end" />
        </div>

        <div className="-mx-5 overflow-x-auto sm:-mx-8">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs uppercase tracking-wider text-muted">
                <th scope="col" className="py-3 pl-5 pr-2 font-semibold sm:pl-8">Services</th>
                <th scope="col" className="w-20 py-3 text-center font-semibold">Quantity</th>
                <th scope="col" className="w-28 py-3 text-right font-semibold">Rate</th>
                <th scope="col" className="w-32 py-3 pr-5 text-right font-semibold sm:pr-8">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={it.id} className={cn("break-inside-avoid border-b border-line align-top", i % 2 === 0 && "bg-canvas")}>
                  <td className="py-4 pl-5 pr-4 sm:pl-8"><ItemText name={it.description} details={it.details} /></td>
                  <td className="num py-4 text-center">{qty(it.quantity)}</td>
                  <td className="num py-4 text-right">{signed(d, it.unitPrice)}</td>
                  <td className="num py-4 pr-5 text-right sm:pr-8">{signed(d, it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Totals d={d} className="mt-6" highlight={false} />
        <PayAndNotes d={d} />
      </div>

      <footer className="mt-8 grid items-center gap-4 border-t border-line px-5 py-5 text-sm sm:grid-cols-3 sm:px-8">
        <Logo d={d} size="sm" />
        <div>
          <p className="font-semibold">{b.name}</p>
          {[b.address, [b.city, b.state].filter(Boolean).join(", ")].filter(Boolean).map((l) => <p key={l!} className="text-muted">{l}</p>)}
        </div>
        <div className="sm:text-right">
          <p className="font-semibold">Contact information</p>
          {[b.phone, b.email].filter(Boolean).map((l) => <p key={l!} className="text-muted">{l}</p>)}
          {d.ids && <p className="text-muted">{d.ids}</p>}
        </div>
      </footer>
    </Sheet>
  );
}

/* ---------- 3. Minimal ---------- */

function Minimal({ d }: { d: Doc }) {
  const { inv, color } = d;
  return (
    <Sheet className="p-6 sm:p-12">
      <PaidStamp d={d} className="right-8 top-12" />
      <header className="flex flex-wrap items-start justify-between gap-6">
        <Logo d={d} />
        <div className="text-right text-sm text-muted">
          <p className="font-semibold text-ink">{d.b.name}</p>
          {d.fromLines.map((l) => <p key={l}>{l}</p>)}
          {d.ids && <p>{d.ids}</p>}
        </div>
      </header>

      <div className="mt-14">
        <p className="text-4xl font-light tracking-tight sm:text-5xl">{d.heading}</p>
        {inv.summary && <p className="mt-2 max-w-xl text-ink-soft">{inv.summary}</p>}
        <p className="mt-2 text-sm text-muted">{d.kindLabel} <span className="num">{inv.number}</span></p>
      </div>

      <div className="mt-10 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
        <BillTo d={d} label="Billed to" />
        <dl className="text-sm">
          {d.meta.slice(1).map(([k, v]) => (
            <div key={k} className="mb-2"><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd className="num">{v}</dd></div>
          ))}
        </dl>
        {!d.isQuote && (
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wider text-muted">Amount due</p>
            <p className="num mt-1 text-3xl font-light" style={{ color }}>{d.m(d.due)}</p>
          </div>
        )}
      </div>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th scope="col" className="pb-3 pr-2 font-normal">Description</th>
              <th scope="col" className="w-16 pb-3 text-right font-normal">Qty</th>
              <th scope="col" className="w-28 pb-3 text-right font-normal">Rate</th>
              <th scope="col" className="w-32 pb-3 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id} className="break-inside-avoid border-t border-line align-top">
                <td className="py-4 pr-6"><ItemText name={it.description} details={it.details} /></td>
                <td className="num py-4 text-right">{qty(it.quantity)}</td>
                <td className="num py-4 text-right">{signed(d, it.unitPrice)}</td>
                <td className="num py-4 text-right">{signed(d, it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Totals d={d} className="mt-6 border-t border-line pt-6" highlight={false} />
      <PayAndNotes d={d} boxed={false} />
    </Sheet>
  );
}

/* ---------- 4. Letterhead (formal, boxed) ---------- */

function Letterhead({ d }: { d: Doc }) {
  const { inv, b, color } = d;
  const on = textOn(color);
  return (
    <Sheet className="p-5 sm:p-10">
      <PaidStamp d={d} className="right-8 top-48" />
      <header className="text-center">
        <div className="flex justify-center"><Logo d={d} size="lg" /></div>
        <p className="mt-3 text-xl font-bold uppercase tracking-wide">{b.legalName || b.name}</p>
        <p className="mt-1 text-sm text-muted">{d.fromLines.join(" · ")}</p>
        {d.ids && <p className="text-sm font-medium">{d.ids}</p>}
        <div aria-hidden className="mt-4 space-y-0.5"><div className="h-1" style={{ background: color }} /><div className="h-px" style={{ background: color }} /></div>
      </header>

      <p className="mt-6 text-center text-lg font-bold uppercase tracking-[0.2em]">{d.heading}</p>
      {inv.summary && <p className="mt-1 text-center text-sm text-ink-soft">{inv.summary}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line-strong p-4"><BillTo d={d} /></div>
        <div className="rounded-lg border border-line-strong p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{d.kindLabel} details</p>
          <Meta d={d} className="mt-2 grid-cols-[auto_1fr] [&_dt]:text-left" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr style={{ background: color, color: on }}>
              <th scope="col" className="w-10 border border-line-strong px-2 py-2 text-center font-semibold">S/N</th>
              <th scope="col" className="border border-line-strong px-3 py-2 text-left font-semibold">Description</th>
              <th scope="col" className="w-16 border border-line-strong px-2 py-2 text-right font-semibold">Qty</th>
              <th scope="col" className="w-28 border border-line-strong px-2 py-2 text-right font-semibold">Unit price</th>
              <th scope="col" className="w-32 border border-line-strong px-2 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={it.id} className="break-inside-avoid align-top">
                <td className="num border border-line-strong px-2 py-2 text-center">{i + 1}</td>
                <td className="border border-line-strong px-3 py-2"><ItemText name={it.description} details={it.details} /></td>
                <td className="num border border-line-strong px-2 py-2 text-right">{qty(it.quantity)}</td>
                <td className="num border border-line-strong px-2 py-2 text-right">{signed(d, it.unitPrice)}</td>
                <td className="num border border-line-strong px-2 py-2 text-right">{signed(d, it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Totals d={d} className="mt-6" />
      <PayAndNotes d={d} />

      <div className="mt-12 grid gap-8 text-sm sm:grid-cols-2">
        <div className="border-t border-ink pt-2">Authorised signatory</div>
        <div className="border-t border-ink pt-2 sm:text-right">For: {b.legalName || b.name}</div>
      </div>
    </Sheet>
  );
}

/* ---------- 5. Compact (many lines per page) ---------- */

function Compact({ d }: { d: Doc }) {
  const { inv, color } = d;
  return (
    <Sheet className="p-4 text-[13px] sm:p-8">
      <PaidStamp d={d} className="right-6 top-16" />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 pb-3" style={{ borderColor: color }}>
        <div className="flex items-center gap-3"><Logo d={d} size="sm" /><div><p className="font-bold">{d.b.name}</p>{d.ids && <p className="text-xs text-muted">{d.ids}</p>}</div></div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase" style={{ color }}>{d.heading}</p>
          <p className="num text-xs text-muted">{inv.number} · {formatDate(inv.issueDate)} · due {formatDate(inv.dueDate)}</p>
        </div>
      </header>
      {inv.summary && <p className="mt-3 text-ink-soft">{inv.summary}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <BillTo d={d} />
        <div className="text-xs text-muted">{d.fromLines.map((l) => <p key={l}>{l}</p>)}</div>
        <div className="sm:text-right">
          {inv.poNumber && <p className="text-xs text-muted">PO / ref <span className="num text-ink">{inv.poNumber}</span></p>}
          {!d.isQuote && <><p className="text-xs uppercase tracking-wider text-muted">Amount due</p><p className="num text-xl font-bold">{d.m(d.due)}</p></>}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{ background: color, color: textOn(color) }}>
              <th scope="col" className="w-8 px-2 py-1.5 font-semibold">#</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Item</th>
              <th scope="col" className="w-14 px-2 py-1.5 text-right font-semibold">Qty</th>
              <th scope="col" className="w-24 px-2 py-1.5 text-right font-semibold">Rate</th>
              <th scope="col" className="w-28 px-2 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={it.id} className="break-inside-avoid border-b border-line align-top">
                <td className="num px-2 py-1.5 text-muted">{i + 1}</td>
                <td className="px-2 py-1.5"><ItemText name={it.description} details={it.details} className="[&>p:first-child]:font-medium [&>p+p]:mt-0.5 [&>p+p]:text-xs" /></td>
                <td className="num px-2 py-1.5 text-right">{qty(it.quantity)}</td>
                <td className="num px-2 py-1.5 text-right">{signed(d, it.unitPrice)}</td>
                <td className="num px-2 py-1.5 text-right">{signed(d, it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Totals d={d} className="mt-4" />
      <PayAndNotes d={d} />
    </Sheet>
  );
}
