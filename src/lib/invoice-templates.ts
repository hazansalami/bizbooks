/** Invoice styles a business can choose in Settings. Shared by the settings picker and the document renderer. */
export const INVOICE_TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "Clean and balanced. Your logo top left, a thin brand-colour rule." },
  { id: "contemporary", name: "Contemporary", blurb: "A bold colour header with the amount due up top. Great for long service descriptions." },
  { id: "minimal", name: "Minimal", blurb: "Lots of white space and fine lines. Quiet, confident, design-studio feel." },
  { id: "letterhead", name: "Letterhead", blurb: "Formal company letterhead with RC and TIN, boxed tables and a signature line. Suits corporate and government clients." },
  { id: "compact", name: "Compact", blurb: "Dense, numbered lines that fit more on a page. Best for invoices with many items." },
] as const;

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATES)[number]["id"];

export function templateId(v: string | null | undefined): InvoiceTemplateId {
  return INVOICE_TEMPLATES.some((t) => t.id === v) ? (v as InvoiceTemplateId) : "classic";
}

function rgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}

/** White or near-black text, whichever reads better on the brand colour (WCAG relative luminance). */
export function textOn(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#14201b";
}

/** The brand colour darkened by `amount` (0–1), for the second header panel. */
export function shade(hex: string, amount = 0.22) {
  return `#${rgb(hex).map((c) => Math.round(c * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}
