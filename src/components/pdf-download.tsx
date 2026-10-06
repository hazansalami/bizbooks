"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonClass } from "./ui";

/** A4 at 96 dpi: the width the document is laid out at for the PDF, whatever the screen size. */
const A4_PX = 794;
const MARGIN_PT = 28;

/** True when the canvas row is (nearly) blank: a safe place to start a new page without cutting text. */
function blankRow(ctx: CanvasRenderingContext2D, y: number, width: number) {
  const row = ctx.getImageData(0, y, width, 1).data;
  for (let i = 0; i < row.length; i += 16) if (row[i] < 245 || row[i + 1] < 245 || row[i + 2] < 245) return false;
  return true;
}

/**
 * Saves the page's document (the `.print-sheet`) straight to a PDF file, laid out exactly as designed:
 * colours, fonts and the desktop layout, even on a phone. Falls back to the print dialog if anything fails.
 */
export async function downloadPdf(filename: string, selector = ".print-sheet") {
  const source = document.querySelector<HTMLElement>(selector);
  if (!source) return window.print();
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([import("modern-screenshot"), import("jspdf")]);

  // Lay a copy out off-screen at A4 width. `.pdf-render` switches on the `doc:` layout (see globals.css).
  const host = document.createElement("div");
  host.className = "pdf-render";
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${A4_PX}px`, background: "#ffffff" });
  const copy = source.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".no-print").forEach((n) => n.remove());
  host.appendChild(copy);
  document.body.appendChild(host);
  let canvas: HTMLCanvasElement;
  // Where each link sits on the laid-out copy (CSS px), so the PDF can keep them clickable.
  let links: { url: string; x: number; y: number; w: number; h: number }[] = [];
  try {
    await document.fonts.ready;
    const origin = copy.getBoundingClientRect();
    links = [...copy.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((a) => /^(https?|mailto|tel):/i.test(a.href))
      .flatMap((a) => [...a.getClientRects()].map((r) => ({ url: a.href, x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height })))
      .filter((l) => l.w > 0 && l.h > 0);
    canvas = await domToCanvas(copy, { scale: 2, backgroundColor: "#ffffff" });
  } finally {
    host.remove();
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN_PT * 2;
  const pxPerPt = canvas.width / contentW;
  const pagePx = Math.floor((pageH - MARGIN_PT * 2) * pxPerPt);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const scale = canvas.width / A4_PX;

  let y = 0;
  let first = true;
  while (y < canvas.height - 2) {
    let end = Math.min(y + pagePx, canvas.height);
    // Don't slice through a line of text: step back to the nearest blank row (up to a fifth of a page).
    if (end < canvas.height) {
      for (let t = end; t > end - pagePx / 5; t -= 2) if (blankRow(ctx, t, canvas.width)) { end = t; break; }
    }
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = end - y;
    slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_PT, MARGIN_PT, contentW, (end - y) / pxPerPt, undefined, "FAST");
    for (const l of links) {
      const top = l.y * scale;
      if (top < y || top >= end) continue;
      pdf.link(MARGIN_PT + (l.x * scale) / pxPerPt, MARGIN_PT + (top - y) / pxPerPt, (l.w * scale) / pxPerPt, (l.h * scale) / pxPerPt, { url: l.url });
    }
    first = false;
    y = end;
  }
  pdf.save(filename.replace(/[\\/:*?"<>|]+/g, "-"));
}

export function DownloadPdfButton({ filename, className, children = "Download PDF", selector }: { filename: string; className?: string; children?: React.ReactNode; selector?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      className={className ?? buttonClass("secondary", "md")}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadPdf(filename, selector);
        } catch (e) {
          console.error("pdf", e);
          window.print();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download className="size-4" aria-hidden />}
      {busy ? "Preparing PDF…" : children}
    </button>
  );
}
