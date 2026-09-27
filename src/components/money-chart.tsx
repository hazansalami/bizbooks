import { naira, nairaShort } from "@/lib/money";

type Row = { label: string; moneyIn: number; moneyOut: number };

/** Paired bars in plain HTML: no chart library, readable on small screens, with a table for screen readers. */
export function MoneyChart({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.moneyIn, r.moneyOut]));
  const empty = rows.every((r) => !r.moneyIn && !r.moneyOut);
  return (
    <div className="mt-4">
      <div className="mb-3 flex gap-4 text-xs font-medium text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" aria-hidden />Money in</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sun" aria-hidden />Money out</span>
      </div>
      <div aria-hidden className="relative grid h-44 grid-cols-6 items-end gap-2 border-b border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex h-full items-end justify-center gap-1" title={`${r.label}: in ${naira(r.moneyIn)}, out ${naira(r.moneyOut)}`}>
            <span className="w-3 rounded-t bg-brand sm:w-4" style={{ height: `${(r.moneyIn / max) * 100}%`, minHeight: r.moneyIn ? 3 : 0 }} />
            <span className="w-3 rounded-t bg-sun sm:w-4" style={{ height: `${(r.moneyOut / max) * 100}%`, minHeight: r.moneyOut ? 3 : 0 }} />
          </div>
        ))}
        {empty && <p className="absolute inset-0 grid place-items-center text-sm text-muted">Your chart fills in as payments and expenses come in.</p>}
      </div>
      <div aria-hidden className="mt-1.5 grid grid-cols-6 gap-2 text-center text-xs text-muted">
        {rows.map((r) => <span key={r.label}>{r.label}</span>)}
      </div>
      <table className="sr-only">
        <caption>Money in and out by month</caption>
        <thead><tr><th>Month</th><th>Money in</th><th>Money out</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{nairaShort(r.moneyIn)}</td><td>{nairaShort(r.moneyOut)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
