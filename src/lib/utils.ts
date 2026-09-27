export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", opts).format(new Date(d));
}

/** yyyy-mm-dd in local time, for <input type="date"> and file names. (toISOString would shift to UTC.) */
export function dateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function timeAgo(d: Date | string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(d);
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function addMonths(d: Date, months: number) {
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + months);
  // Keep the 31st on the last day of shorter months instead of spilling into the next one.
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(form: FormData, key: string) {
  return str(form, key) || null;
}

export function dateOrNull(form: FormData, key: string) {
  const v = str(form, key);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function randomToken(bytes = 18) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("base64url");
}

/** Nigerian numbers to international format for WhatsApp links: 0803… → 234803… */
export function whatsappNumber(phone: string | null | undefined) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = "234" + d.slice(1);
  if (d.length === 10 && /^[789]/.test(d)) d = "234" + d;
  return d.length >= 11 ? d : null;
}

export function whatsappLink(phone: string | null | undefined, text: string) {
  const n = whatsappNumber(phone);
  const q = encodeURIComponent(text);
  return n ? `https://wa.me/${n}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

const COMPANY_WORDS = /\b(ltd|limited|plc|stores?|enterprises?|ventures?|services|company|co|global|nig|nigeria|hub|group|industries|foods?|logistics|events|school|church|academy|agency|clinic|hotel|foundation)\b|&/i;

/** "Hello Chioma" for people, "Hello Eko Retail Stores" for companies. */
export function greetingName(name: string) {
  const trimmed = name.trim();
  if (COMPANY_WORDS.test(trimmed)) return trimmed;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  // Keep titles with the name: "Mrs. Adeyemi", "Dr Okafor".
  return /^(mr|mrs|ms|miss|dr|chief|alhaji|alhaja|pastor|engr|prof)\.?$/i.test(first) ? trimmed : first;
}
