/** Tolerant CSV and value parsing for files exported from other accounting tools. Runs in the browser and on the server. */

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF, BOM. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim()));
}

/** "NGN1,022,000.00", "₦350,000", "(₦350,000.00)", "-1,000.50", "1.022.000,00"-free inputs. NaN when empty. */
export function parseMoney(v: string | undefined | null): number {
  if (v == null) return NaN;
  let s = String(v).trim();
  if (!s || s === "-" || s === "—") return NaN;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
  s = s.replace(/[()]/g, "").replace(/^[A-Za-z]{3}\s*/, "").replace(/\s*[A-Za-z]{3}$/, "").replace(/[₦$€£,\s-]/g, "");
  if (!s || !/^\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return negative ? -n : n;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// Real calendar dates only: 31/02 is a typo to flag, not 3 March.
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && y > 1900 && d <= daysIn(y, m) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

export type DateOrder = "DMY" | "MDY";

/**
 * Works out whether slash dates are day-first (Nigerian default) or month-first from the values themselves,
 * and says whether it had to guess: when there are slash dates and every one
 * reads both ways (03/04/2026), the file alone can't tell, and the owner should confirm.
 */
export function dateOrderOf(values: string[]): { order: DateOrder; guessed: boolean } {
  let slashDates = false;
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v.trim());
    if (!m) continue;
    slashDates = true;
    if (Number(m[1]) > 12) return { order: "DMY", guessed: false };
    if (Number(m[2]) > 12) return { order: "MDY", guessed: false };
  }
  return { order: "DMY", guessed: slashDates };
}

/** Returns YYYY-MM-DD or null. Handles ISO, 24/09/2026, 09/24/2026, 24-Sep-2026, Sep 24, 2026, 24 September 2026. */
export function parseDate(v: string | undefined | null, order: DateOrder = "DMY"): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) return order === "DMY" ? iso(year(m[3]), Number(m[2]), Number(m[1])) : iso(year(m[3]), Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]*(\d{2,4})$/.exec(s);
  if (m) return iso(year(m[3]), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, Number(m[1]));
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, Number(m[2]));
  return null;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Find a column by any of its known names (exact first, then "starts with"). */
export function column(headers: string[], ...names: string[]): number {
  const h = headers.map(norm);
  for (const n of names) {
    const i = h.indexOf(norm(n));
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = h.findIndex((x) => x.startsWith(norm(n)));
    if (i >= 0) return i;
  }
  return -1;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Trailing digits of an invoice number: "0331" → 331, "INV-000123" → 123. */
export function numberPart(n: string) {
  const m = /(\d+)\D*$/.exec(n);
  return m ? Number(m[1]) : NaN;
}
