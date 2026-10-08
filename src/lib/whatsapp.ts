import "server-only";
import { whatsappNumber } from "./utils";

/*
  Automatic WhatsApp reminders through Meta's official WhatsApp Cloud API.
  Business-initiated messages must use a template approved in WhatsApp Manager. Expected template
  (WHATSAPP_REMINDER_TEMPLATE, language WHATSAPP_TEMPLATE_LANG, default "en"), body with five variables:
    "Hello {{1}}, a reminder from {{2}}: invoice {{3}} for {{4}} {{5}}. Pay here: {{6}}"
  Variables: client name, business name, invoice number, amount, "was due on 2 Oct" / "is due on 9 Oct", pay link.
  Switched on by WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID. Without them nothing is sent automatically,
  and owners use the one-tap WhatsApp links instead.
*/

export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_REMINDER_TEMPLATE);
}

export async function sendWhatsAppReminder(phone: string | null | undefined, params: [string, string, string, string, string, string]) {
  if (!whatsappConfigured()) return { ok: false as const, error: "not configured" };
  const to = whatsappNumber(phone);
  if (!to) return { ok: false as const, error: "no usable phone number" };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_REMINDER_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.slice(0, 200) })) }],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok ? { ok: true as const } : { ok: false as const, error: `WhatsApp returned ${res.status}` };
  } catch {
    return { ok: false as const, error: "couldn't reach WhatsApp" };
  }
}
