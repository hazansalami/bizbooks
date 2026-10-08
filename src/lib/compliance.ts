import "server-only";
import { db } from "./db";
import { obligationStatus, taxObligations } from "./taxes";

/*
  Compliance score and vendor pack (opt-in per business).
  Big clients, banks and government agencies ask suppliers for the same papers again and again: CAC
  certificate, tax clearance, pension and ITF certificates. BizBooks keeps them in one place, warns before
  they expire, scores how ready the company is, and bundles them into one PDF to send with a tender.
*/

export const DOC_KINDS = {
  CAC_CERT: { label: "CAC certificate of incorporation", hint: "The certificate from the Corporate Affairs Commission.", expires: false },
  CAC_STATUS: { label: "CAC status report", hint: "Shows directors, shareholders and that annual returns are filed. Most buyers want one under a year old.", expires: true },
  MEMART: { label: "Memorandum and articles of association", hint: "For limited companies.", expires: false },
  TCC: { label: "Tax clearance certificate (TCC)", hint: "From the tax authority on TaxPro-Max. Valid to 31 December of the year it's issued for.", expires: true },
  PENCOM: { label: "Pension compliance certificate", hint: "From PenCom, for companies with 3 or more staff. Valid for a year.", expires: true },
  ITF: { label: "ITF compliance certificate", hint: "Industrial Training Fund, for companies with 5 or more staff or ₦50m+ turnover.", expires: true },
  NSITF: { label: "NSITF compliance certificate", hint: "Employee compensation scheme.", expires: true },
  BPP: { label: "BPP registration", hint: "Bureau of Public Procurement, for government contracts.", expires: true },
  OTHER: { label: "Other document", hint: "Licences, permits, reference letters, insurance.", expires: false },
} as const;
export type DocKind = keyof typeof DOC_KINDS;
export const isDocKind = (k: string): k is DocKind => k in DOC_KINDS;

export const DOC_MAX_BYTES = 3_000_000;
export const DOC_TYPES: Record<string, string> = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPEG" };

/** Checks the file really is what it says (PDF, PNG or JPEG), whatever its name or declared type. */
export function sniffType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

export type DocStatus = "VALID" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";
export function docStatus(expiresAt: Date | null, now = new Date()): DocStatus {
  if (!expiresAt) return "NO_EXPIRY";
  if (expiresAt < now) return "EXPIRED";
  if (expiresAt.getTime() - now.getTime() < 30 * 864e5) return "EXPIRING";
  return "VALID";
}

/** Metadata only: the file bytes stay in the database until someone opens or bundles them. */
export const docSelect = { id: true, kind: true, title: true, fileName: true, mimeType: true, size: true, issuedAt: true, expiresAt: true, createdAt: true } as const;

export type Check = { key: string; label: string; done: boolean; weight: number; detail: string; href: string };

type ScoreBusiness = { id: string; tin: string | null; rcNumber: string | null; entityType: string; vatRegistered: boolean };

/** What a buyer's vendor team checks, weighted by how often a missing item stops a registration. */
export async function complianceScore(b: ScoreBusiness, now = new Date()) {
  const [docs, staff, obligations] = await Promise.all([
    db.companyDocument.findMany({ where: { businessId: b.id }, select: docSelect }),
    db.employee.count({ where: { businessId: b.id, status: "ACTIVE", kind: "EMPLOYEE" } }),
    taxObligations(b, 3),
  ]);
  const latest = (kind: DocKind) => docs.filter((d) => d.kind === kind).sort((x, y) => (y.expiresAt?.getTime() ?? Infinity) - (x.expiresAt?.getTime() ?? Infinity))[0];
  const valid = (kind: DocKind) => { const d = latest(kind); return !!d && docStatus(d.expiresAt, now) !== "EXPIRED"; };
  const overdue = obligations.filter((o) => obligationStatus(o, now) === "overdue");
  const statusReport = latest("CAC_STATUS");
  const reportFresh = !!statusReport && (statusReport.issuedAt ?? statusReport.createdAt).getTime() > now.getTime() - 365 * 864e5;
  const company = b.entityType === "LTD";

  const checks: Check[] = [
    { key: "tin", label: "Tax ID (TIN) on your profile", done: !!b.tin, weight: 10, detail: b.tin ? `TIN ${b.tin}` : "Every vendor form asks for it.", href: "/app/settings" },
    { key: "rc", label: company ? "RC number on your profile" : "Business name number on your profile", done: !!b.rcNumber, weight: 10, detail: b.rcNumber ? `${company ? "RC" : "BN"} ${b.rcNumber}` : "Shows the company is registered with CAC.", href: "/app/settings" },
    { key: "cac", label: "CAC certificate on file", done: !!latest("CAC_CERT"), weight: 15, detail: latest("CAC_CERT") ? "Uploaded" : "Upload a scan or the PDF from the CAC portal.", href: "#upload" },
    { key: "tcc", label: "Valid tax clearance certificate", done: valid("TCC"), weight: 20, detail: latest("TCC") ? (valid("TCC") ? "Valid" : "Expired: request this year's on TaxPro-Max.") : "Request it on TaxPro-Max, then upload it here.", href: "#upload" },
    { key: "filings", label: "Taxes remitted on time", done: overdue.length === 0, weight: 25, detail: overdue.length ? `${overdue.length} overdue: ${overdue.map((o) => o.title).slice(0, 2).join(", ")}${overdue.length > 2 ? "…" : ""}` : "Nothing overdue in the last 3 months.", href: "/app/taxes" },
    { key: "status", label: "CAC status report under a year old", done: reportFresh, weight: 10, detail: statusReport ? (reportFresh ? "Current" : "Over a year old: download a new one from the CAC portal.") : "Shows annual returns are up to date.", href: "#upload" },
    ...(staff >= 3 ? [{ key: "pencom", label: "Valid pension compliance certificate", done: valid("PENCOM"), weight: 10, detail: latest("PENCOM") ? (valid("PENCOM") ? "Valid" : "Expired: renew with PenCom.") : `You have ${staff} staff, so buyers will expect one.`, href: "#upload" }] : []),
  ];
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.done ? c.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks, docs, staff };
}

/**
 * Daily: one email per business when a document expires in 30 days, in 7 days, or today. Only for businesses
 * that switched compliance tracking on.
 */
export async function runExpiryReminders(now = new Date()) {
  const { addDays, daysBetween, formatDate, startOfDay } = await import("./utils");
  const { layout, sendEmail, escapeHtml: esc } = await import("./email");
  const { siteUrl } = await import("./site-url");
  const today = startOfDay(now);
  const docs = await db.companyDocument.findMany({
    where: { expiresAt: { gte: today, lt: addDays(today, 31) }, business: { complianceTracking: true } },
    select: { title: true, expiresAt: true, businessId: true, business: { select: { name: true, email: true, owner: { select: { email: true, fullName: true } } } } },
  });
  const due = docs.filter((d) => [30, 7, 0].includes(daysBetween(today, startOfDay(d.expiresAt!))));
  const byBusiness = new Map<string, typeof due>();
  for (const d of due) (byBusiness.get(d.businessId) ?? byBusiness.set(d.businessId, []).get(d.businessId)!).push(d);
  let sent = 0;
  for (const list of byBusiness.values()) {
    const b = list[0].business;
    const lines = list.map((d) => {
      const left = daysBetween(today, startOfDay(d.expiresAt!));
      return `<strong>${esc(d.title)}</strong>: ${left === 0 ? "expires today" : `expires on ${formatDate(d.expiresAt!)} (${left} days)`}`;
    });
    const { html, text } = layout({
      heading: list.length === 1 ? `${list[0].title} is about to expire` : `${list.length} company documents are about to expire`,
      paragraphs: [
        `Hi ${esc(b.owner.fullName.split(" ")[0])}, a heads-up for ${esc(b.name)}:`,
        lines.join("<br>"),
        "Renew early so a vendor registration or tender isn't held up. Upload the new copy to BizBooks and your vendor pack stays current.",
      ],
      button: { label: "Open compliance", href: new URL("/app/compliance", siteUrl()).toString() },
    });
    const r = await sendEmail({ to: b.email || b.owner.email, subject: list.length === 1 ? `${list[0].title} expires soon` : "Company documents expiring soon", html, text });
    if (r.ok) sent++;
  }
  return { sent };
}
