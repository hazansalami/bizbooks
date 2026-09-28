import "server-only";
import { APP_NAME } from "./constants";

/*
  Transactional email through Resend's HTTP API (no SDK needed). Without RESEND_API_KEY the
  message is logged instead, so local development and the WhatsApp-first flow still work.
*/
export type Email = { to: string; subject: string; html: string; text: string; replyTo?: string | null; fromName?: string };

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(e: Email): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) {
    console.info(`[email:dev] to=${e.to} subject="${e.subject}"\n${e.text}`);
    return { ok: true };
  }
  const fromAddress = process.env.EMAIL_FROM!;
  const from = e.fromName ? `${e.fromName.replace(/[<>"]/g, "")} via ${APP_NAME} <${fromAddress}>` : `${APP_NAME} <${fromAddress}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text, reply_to: e.replyTo || undefined }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, error: `Email service returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the email service" };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Simple, mostly-text layout: it renders well in Gmail on cheap Android phones and survives
 * forwarding. One big button that goes straight to payment.
 */
export function layout(opts: { heading: string; paragraphs: string[]; button?: { label: string; href: string }; after?: string[]; footer?: string; color?: string }) {
  const color = opts.color || "#0E7A55";
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#23302b">${t}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f4ef;padding:24px 12px;font-family:Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e6e1d6" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 24px">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#14201b">${esc(opts.heading)}</h1>
${opts.paragraphs.map(p).join("")}
${opts.button ? `<p style="margin:22px 0"><a href="${esc(opts.button.href)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 24px;border-radius:999px">${esc(opts.button.label)}</a></p>` : ""}
${(opts.after ?? []).map(p).join("")}
</td></tr></table>
<p style="font-size:12px;color:#6b746f;margin:16px 0 0">${opts.footer ?? `Sent with ${APP_NAME}`}</p>
</td></tr></table></body></html>`;
  const text = [opts.heading, "", ...opts.paragraphs.map(stripTags), ...(opts.button ? ["", `${opts.button.label}: ${opts.button.href}`] : []), "", ...(opts.after ?? []).map(stripTags)].join("\n");
  return { html, text };
}

function stripTags(s: string) {
  return s
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/td>\s*<td[^>]*>/g, ": ")
    .replace(/<\/tr>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}

export { esc as escapeHtml };
