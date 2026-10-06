import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "./db";
import { DOC_KINDS, docStatus, type DocKind } from "./compliance";
import { ENTITY_TYPES } from "./constants";
import { formatDate } from "./utils";

/*
  One PDF to attach to a vendor registration or tender: a cover sheet with the company's details and a list
  of what's enclosed, then each current document (expired ones are left out). Uses the built-in Helvetica,
  which has no naira sign, so nothing on the cover is a naira amount.
*/

const A4: [number, number] = [595.28, 841.89];
const M = 56;
const INK = rgb(0.08, 0.13, 0.11);
const MUTED = rgb(0.37, 0.42, 0.39);

function hexColor(hex: string | null | undefined) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  const n = m ? parseInt(m[1], 16) : 0x0e7a55;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Helvetica only covers Latin-1: swap anything else so a name like "Ọlá" doesn't break the file. */
const latin = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of latin(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export async function buildVendorPack(businessId: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, include: { bankAccounts: true } });
  const all = await db.companyDocument.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
  // The newest current copy of each kind ("Other" documents all go in).
  const seen = new Set<string>();
  const docs = all.filter((d) => {
    if (docStatus(d.expiresAt) === "EXPIRED") return false;
    if (d.kind === "OTHER") return true;
    if (seen.has(d.kind)) return false;
    seen.add(d.kind);
    return true;
  }).sort((x, y) => Object.keys(DOC_KINDS).indexOf(x.kind) - Object.keys(DOC_KINDS).indexOf(y.kind));

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${b.legalName || b.name}: company documents`);
  pdf.setProducer("BizBooks");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = hexColor(b.brandColor);

  const cover = pdf.addPage(A4);
  let y = A4[1] - M;
  const text = (page: PDFPage, s: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10.5;
    for (const line of wrap(s, opts.font ?? regular, size, A4[0] - (opts.x ?? M) - M)) {
      page.drawText(line, { x: opts.x ?? M, y, size, font: opts.font ?? regular, color: opts.color ?? INK });
      y -= size * 1.45;
    }
    y -= opts.gap ?? 0;
  };

  cover.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: brand });
  text(cover, "COMPANY DOCUMENTS", { size: 10, font: bold, color: brand, gap: 6 });
  text(cover, b.legalName || b.name, { size: 22, font: bold, gap: 2 });
  if (b.legalName && b.legalName !== b.name) text(cover, `Trading as ${b.name}`, { color: MUTED });
  text(cover, `Prepared ${formatDate(new Date())}`, { size: 9.5, color: MUTED, gap: 18 });

  const rows: [string, string | null | undefined][] = [
    ["Business type", ENTITY_TYPES[b.entityType] ?? b.entityType],
    [b.entityType === "LTD" ? "RC number" : "BN number", b.rcNumber],
    ["Tax ID (TIN)", b.tin],
    ["VAT", b.vatRegistered ? "Registered, charges VAT" : "Not registered for VAT"],
    ["Address", [b.address, b.city, b.state].filter(Boolean).join(", ")],
    ["Phone", b.phone],
    ["Email", b.email],
    ...[...b.bankAccounts].sort((x, z) => Number(z.isDefault) - Number(x.isDefault)).slice(0, 2).map((a): [string, string] => ["Bank account", `${a.bankName} ${a.accountNumber} (${a.accountName})`]),
  ];
  for (const [label, value] of rows) {
    if (!value) continue;
    const top = y;
    cover.drawText(latin(label), { x: M, y, size: 10, font: bold, color: MUTED });
    text(cover, value, { x: M + 130, size: 10.5 });
    y = Math.min(y, top - 15) - 3;
  }

  y -= 14;
  cover.drawLine({ start: { x: M, y: y + 8 }, end: { x: A4[0] - M, y: y + 8 }, thickness: 0.75, color: rgb(0.85, 0.83, 0.78) });
  y -= 10;
  text(cover, "Enclosed", { size: 13, font: bold, gap: 4 });
  if (!docs.length) text(cover, "No documents uploaded yet.", { color: MUTED });
  docs.forEach((d, i) => {
    const kind = DOC_KINDS[d.kind as DocKind]?.label ?? d.kind;
    const name = d.kind === "OTHER" || d.title !== kind ? `${kind}: ${d.title}` : kind;
    const dates = [d.issuedAt && `issued ${formatDate(d.issuedAt)}`, d.expiresAt && `valid until ${formatDate(d.expiresAt)}`].filter(Boolean).join(", ");
    text(cover, `${i + 1}.  ${name}${dates ? `  (${dates})` : ""}`, { gap: 2 });
  });

  y = M;
  cover.drawText(latin(`Generated with BizBooks from documents uploaded by ${b.legalName || b.name}.`), { x: M, y, size: 8.5, font: regular, color: MUTED });

  const skipped: string[] = [];
  for (const d of docs) {
    try {
      if (d.mimeType === "application/pdf") {
        const src = await PDFDocument.load(d.data, { ignoreEncryption: true });
        for (const p of await pdf.copyPages(src, src.getPageIndices())) pdf.addPage(p);
      } else {
        const img = d.mimeType === "image/png" ? await pdf.embedPng(d.data) : await pdf.embedJpg(d.data);
        const page = pdf.addPage(A4);
        const scale = Math.min((A4[0] - M) / img.width, (A4[1] - M) / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
      }
    } catch {
      skipped.push(d.title);
    }
  }
  if (skipped.length) {
    // Note it on the cover so the reader isn't left looking for a missing document.
    cover.drawText(latin(`Could not be included: ${skipped.join(", ")}`).slice(0, 110), { x: M, y: M + 14, size: 8.5, font: bold, color: rgb(0.7, 0.15, 0.1) });
  }
  return { bytes: await pdf.save(), name: b.legalName || b.name, count: docs.length };
}
