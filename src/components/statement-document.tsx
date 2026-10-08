import type { ClientStatement } from "@/lib/client-statement";
import { money } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";
import { shade, textOn } from "@/lib/invoice-templates";

type Biz = {
  name: string; legalName: string | null; logo: string | null; brandColor: string; address: string | null; city: string | null; state: string | null;
  phone: string | null; email: string | null; rcNumber: string | null; tin: string | null; entityType: string;
  bankAccounts: { id: string; bankName: string; accountNumber: string; accountName: string; isDefault: boolean }[];
};

/** Statement of account, in the business's colours. Same `print-sheet`/`doc:` rules as invoices, so it saves to PDF. */
export function StatementDocument({ b, s }: { b: Biz; s: ClientStatement }) {
  const color = b.brandColor || "#0E7A55";
  const m = (n: number) => money(n, s.currency);
  const fromLines = [b.address, [b.city, b.state].filter(Boolean).join(", "), b.phone, b.email].filter(Boolean) as string[];
  const ids = [b.rcNumber && `${b.entityType === "BN" ? "BN" : "RC"} ${b.rcNumber}`, b.tin && `TIN ${b.tin}`].filter(Boolean).join(" · ");
  const owed = s.closing > 0.005;
  const banks = [...b.bankAccounts].sort((x, y) => Number(y.isDefault) - Number(x.isDefault)).slice(0, 2);
  const aging = [
    ["Not yet due", s.aging.current], ["1–30 days late", s.aging.d30], ["31–60 days", s.aging.d60], ["61–90 days", s.aging.d90], ["Over 90 days", s.aging.older],
  ] as const;

  return (
    <article className="print-sheet relative overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
      <div className="p-5 doc:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            {b.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo} alt={`${b.name} logo`} className="max-h-14 max-w-36 object-contain" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold" style={{ background: color, color: textOn(color) }}>{initials(b.name)}</span>
            )}
            <div className="text-sm">
              <p className="text-base font-bold">{b.name}</p>
              {b.legalName && b.legalName !== b.name && <p className="text-muted">{b.legalName}</p>}
              {fromLines.map((l) => <p key={l} className="text-muted">{l}</p>)}
              {ids && <p className="text-muted">{ids}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide" style={{ color }}>Statement of account</p>
            <p className="text-sm text-muted">{s.from ? `${formatDate(s.from)} – ${formatDate(s.to)}` : `All activity to ${formatDate(s.to)}`}</p>
            <p className="text-sm text-muted">Issued {formatDate(new Date())}{s.currency !== "NGN" ? ` · in ${s.currency}` : ""}</p>
          </div>
        </header>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Account of</p>
          <p className="mt-1 text-lg font-semibold">{s.customer.name}</p>
          {s.customer.contactName && <p className="text-sm text-muted">Attn: {s.customer.contactName}</p>}
          {s.customer.address && <p className="text-sm text-muted">{s.customer.address}</p>}
          {s.customer.tin && <p className="text-sm text-muted">TIN {s.customer.tin}</p>}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line doc:grid-cols-4">
          {[["Opening balance", s.opening], ["Invoiced", s.invoiced], ["Paid & deducted", s.received + s.wht]].map(([l, v]) => (
            <div key={l as string} className="bg-paper p-3"><dt className="text-xs text-muted">{l}</dt><dd className="num mt-0.5 font-semibold">{m(v as number)}</dd></div>
          ))}
          <div className="p-3" style={{ background: owed ? color : `${color}14`, color: owed ? textOn(color) : undefined }}>
            <dt className={cn("text-xs", !owed && "text-muted")} style={owed ? { opacity: 0.85 } : undefined}>{owed ? "Balance due" : "Balance"}</dt>
            <dd className="num mt-0.5 text-lg font-bold">{owed ? m(s.closing) : s.closing < -0.005 ? `${m(-s.closing)} in credit` : "Nothing owed"}</dd>
          </div>
        </dl>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[34rem] table-fixed text-sm">
            <colgroup><col className="w-[14%]" /><col className="w-[13%]" /><col /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[16%]" /></colgroup>
            <thead>
              <tr className="border-b-2 text-left text-xs uppercase tracking-wider text-muted" style={{ borderColor: color }}>
                <th scope="col" className="py-2 pr-2 font-semibold">Date</th>
                <th scope="col" className="py-2 pr-2 font-semibold">Reference</th>
                <th scope="col" className="py-2 pr-2 font-semibold">Details</th>
                <th scope="col" className="py-2 text-right font-semibold">Charges</th>
                <th scope="col" className="py-2 text-right font-semibold">Credits</th>
                <th scope="col" className="py-2 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {s.from && (
                <tr className="border-b border-line bg-canvas/60">
                  <td className="py-2.5 pr-2 whitespace-nowrap">{formatDate(s.from)}</td>
                  <td className="py-2.5 pr-2" colSpan={2}>Balance brought forward</td>
                  <td /><td />
                  <td className="num py-2.5 text-right font-medium">{m(s.opening)}</td>
                </tr>
              )}
              {s.lines.map((l, i) => (
                <tr key={i} className="break-inside-avoid border-b border-line align-top">
                  <td className="py-2.5 pr-2 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="num py-2.5 pr-2 whitespace-nowrap font-medium">{l.href ? <a href={l.href} className="hover:underline">{l.ref}</a> : l.ref}</td>
                  <td className="py-2.5 pr-2 text-ink-soft">{l.kind === "INVOICE" ? `Invoice${l.detail ? ` · ${l.detail}` : ""}` : l.detail}</td>
                  <td className="num py-2.5 text-right">{l.charge ? m(l.charge) : ""}</td>
                  <td className="num py-2.5 text-right">{l.credit ? m(l.credit) : ""}</td>
                  <td className="num py-2.5 text-right font-medium">{m(l.balance)}</td>
                </tr>
              ))}
              {!s.lines.length && (
                <tr><td colSpan={6} className="py-6 text-center text-muted">No invoices or payments in this period.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="pt-3 text-right font-semibold">Closing balance</td>
                <td className="num pt-3 text-right text-base font-bold" style={{ color: owed ? shade(color, 0.25) : undefined }}>{m(s.closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {s.outstanding > 0.005 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Unpaid invoices by age, as of {formatDate(new Date())}</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 doc:grid-cols-5">
              {aging.map(([label, v], i) => (
                <div key={label} className={cn("rounded-lg border p-2.5", v > 0.005 && i >= 2 ? "border-danger/40" : "border-line")}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className={cn("num font-semibold", v > 0.005 && i >= 2 && "text-danger")}>{v > 0.005 ? m(v) : "–"}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <footer className="mt-8 grid gap-4 border-t border-line pt-5 text-sm doc:grid-cols-2">
          {owed && banks.length > 0 && s.currency === "NGN" ? (
            <div>
              <p className="font-semibold">How to pay</p>
              {banks.map((a) => <p key={a.id} className="mt-1"><span className="text-muted">{a.bankName}:</span> <span className="num font-semibold">{a.accountNumber}</span> · {a.accountName}</p>)}
              <p className="mt-1 text-muted">Please quote the invoice numbers in your transfer narration.</p>
            </div>
          ) : <div />}
          <div className="doc:text-right">
            <p className="font-semibold" style={{ color: shade(color, 0.25) }}>{owed ? "Thank you for settling the balance." : "Thank you for your business."}</p>
            <p className="mt-1 text-muted">Questions about this statement? {b.email || b.phone || "Contact us"}</p>
          </div>
        </footer>
      </div>
    </article>
  );
}
