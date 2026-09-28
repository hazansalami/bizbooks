"use client";

import { useEffect, useRef, useState } from "react";
import { naira, nairaShort } from "@/lib/money";
import { CATEGORICAL, OTHER } from "@/lib/viz";

/*
  Charts in plain SVG (no library), following the dataviz method:
  validated palette (green in / deep amber out / blue net, all-pairs CVD-safe on white),
  bars <= 24px with 4px rounded data-ends, 2px line, >= 8px ringed markers, hairline grid,
  legend for 2+ series, hover tooltip per column, and an sr-only table for every chart.
*/

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4, integer = false) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const found = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const step = integer ? Math.max(1, Math.ceil(found)) : found;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

export type Series = { key: string; label: string; color: string; kind?: "bar" | "line" };
type Row = { label: string } & Record<string, number | string>;

/** Rounded-top bar path growing from the baseline (square at the baseline). */
function barPath(x: number, y0: number, w: number, y1: number) {
  const h = Math.abs(y0 - y1);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return "";
  if (y1 < y0) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

/** unit "count" shows plain numbers (sign-ups, invoices) instead of naira. */
export function ColumnChart({ rows, series, height = 240, caption, unit = "naira" }: { rows: Row[]; series: Series[]; height?: number; caption: string; unit?: "naira" | "count" }) {
  const short = unit === "count" ? (n: number) => n.toLocaleString("en-NG") : nairaShort;
  const full = unit === "count" ? (n: number) => n.toLocaleString("en-NG") : (n: number) => naira(n);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const bars = series.filter((s) => s.kind !== "line");
  const lines = series.filter((s) => s.kind === "line");
  const values = rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0));
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4, unit === "count");
  const pad = { l: 52, r: 8, t: 10, b: 26 };
  const W = Math.max(width, 240);
  const H = height;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v: number) => pad.t + plotH - ((v - lo) / (hi - lo)) * plotH;
  const band = plotW / rows.length;
  const barW = Math.min(24, (band * 0.7 - 2 * (bars.length - 1)) / bars.length);
  const groupW = barW * bars.length + 2 * (bars.length - 1);
  const cx = (i: number) => pad.l + band * i + band / 2;
  const labelEvery = Math.ceil(rows.length / Math.max(1, Math.floor(plotW / 44)));
  const empty = values.every((v) => v === 0);

  return (
    <div className="mt-3">
      {series.length > 1 && <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted" aria-hidden>
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            {s.kind === "line" ? <span className="h-0.5 w-4 rounded" style={{ background: s.color }} /> : <span className="size-2.5 rounded-sm" style={{ background: s.color }} />}
            {s.label}
          </li>
        ))}
      </ul>}
      <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={W} height={H} role="img" aria-label={caption} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#cfc8b9" : "#ece8df"} strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#5e6a64">{short(t)}</text>
              </g>
            ))}
            {hover !== null && <rect x={pad.l + band * hover} y={pad.t} width={band} height={plotH} fill="#0E7A55" opacity={0.06} />}
            {rows.map((r, i) => (
              <g key={r.label + i}>
                {bars.map((s, j) => {
                  const v = Number(r[s.key]) || 0;
                  const x = cx(i) - groupW / 2 + j * (barW + 2);
                  return <path key={s.key} d={barPath(x, y(0), barW, y(v))} fill={s.color} />;
                })}
                {i % labelEvery === 0 && <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#5e6a64">{r.label}</text>}
              </g>
            ))}
            {lines.map((s) => (
              <g key={s.key}>
                <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={rows.map((r, i) => `${cx(i)},${y(Number(r[s.key]) || 0)}`).join(" ")} />
                {rows.map((r, i) => <circle key={i} cx={cx(i)} cy={y(Number(r[s.key]) || 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />)}
              </g>
            ))}
            {rows.map((_, i) => (
              <rect key={i} x={pad.l + band * i} y={pad.t} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            ))}
          </svg>
        )}
        {empty && width > 0 && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Fills in as money comes in and goes out.</p>}
        {hover !== null && width > 0 && (
          <div className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-line bg-paper p-3 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(cx(hover) + 12, 0), W - 170) }}>
            <p className="mb-1.5 text-sm font-semibold">{rows[hover].label}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <span className="num font-semibold">{full(Number(rows[hover][s.key]) || 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th>Month</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td>{r.label}</td>{series.map((s) => <td key={s.key}>{full(Number(r[s.key]) || 0)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Expense breakdown: top 6 categories in fixed categorical order, the rest folded into "Other". */
export function Donut({ items, caption }: { items: { name: string; amount: number }[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.amount, 0);
  const top = items.slice(0, 6);
  const rest = items.slice(6).reduce((s, i) => s + i.amount, 0);
  const slices = [...top.map((t, i) => ({ ...t, color: CATEGORICAL[i] })), ...(rest > 0 ? [{ name: "Other", amount: rest, color: OTHER }] : [])];
  if (!total) return <p className="mt-6 text-center text-muted">No expenses in this period.</p>;
  const R = 70, r = 44, C = 90;
  let angle = -Math.PI / 2;
  const gap = slices.length > 1 ? 0.02 : 0;
  const arcs = slices.map((s) => {
    const a0 = angle + gap / 2;
    const a1 = angle + (s.amount / total) * Math.PI * 2 - gap / 2;
    angle += (s.amount / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    // Rounded so the server and browser produce identical paths (no hydration mismatch).
    const p = (rad: number, a: number) => `${(C + rad * Math.cos(a)).toFixed(2)},${(C + rad * Math.sin(a)).toFixed(2)}`;
    const d = slices.length === 1
      ? `M${C},${C - R}A${R},${R} 0 1 1 ${C - 0.01},${C - R}L${C - 0.01},${C - r}A${r},${r} 0 1 0 ${C},${C - r}Z`
      : `M${p(R, a0)}A${R},${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large} 0 ${p(r, a0)}Z`;
    return { ...s, d };
  });
  const focus = hover !== null ? arcs[hover] : null;
  return (
    <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <svg viewBox="0 0 180 180" className="size-44 shrink-0" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
        {arcs.map((a, i) => <path key={a.name} d={a.d} fill={a.color} opacity={hover === null || hover === i ? 1 : 0.35} onMouseEnter={() => setHover(i)} />)}
        <text x={C} y={C - 4} textAnchor="middle" fontSize={11} fill="#5e6a64">{focus ? focus.name.slice(0, 16) : "Total"}</text>
        <text x={C} y={C + 13} textAnchor="middle" fontSize={15} fontWeight={700} fill="#14201b">{nairaShort(focus ? focus.amount : total)}</text>
      </svg>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {arcs.map((a, i) => (
          <li key={a.name} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: a.color }} aria-hidden />
            <span className="flex-1 truncate">{a.name}</span>
            <span className="num text-muted">{Math.round((a.amount / total) * 100)}%</span>
            <span className="num w-20 text-right font-semibold">{nairaShort(a.amount)}</span>
          </li>
        ))}
      </ul>
      <table className="sr-only"><caption>{caption}</caption><tbody>{arcs.map((a) => <tr key={a.name}><td>{a.name}</td><td>{naira(a.amount)}</td></tr>)}</tbody></table>
    </div>
  );
}
