"use server";

import { db } from "@/lib/db";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { TOOL_BY_SLUG } from "@/lib/tools";
import { str } from "@/lib/utils";
import { enrolment, nurtureFooter, unsubscribeHeaders } from "@/lib/nurture";
import type { FormState } from "@/components/form-bits";

/**
 * Optional lead capture on public calculators: the calculator itself is never gated.
 * We email the visitor their breakdown plus the most useful next resource for that tool.
 */
export async function emailResults(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const tool = TOOL_BY_SLUG[str(form, "tool")];
  if (str(form, "company")) return { ok: true, message: "Sent." }; // honeypot
  if (!/^\S+@\S+\.\S+$/.test(email)) return { errors: { email: "Enter a valid email address." }, values: { email } };
  if (!tool) return { message: "Something went wrong. Please try again." };

  let lines: [string, string][] = [];
  try {
    lines = (JSON.parse(str(form, "lines") || "[]") as [string, string][]).slice(0, 20).map(([a, b]) => [String(a).slice(0, 80), String(b).slice(0, 40)]);
  } catch {}
  const inputs = str(form, "inputs").slice(0, 500);

  // Light rate limit: at most 5 emails per address per tool per day.
  const since = new Date(Date.now() - 86400000);
  const recent = await db.lead.count({ where: { email, tool: tool.slug, createdAt: { gte: since } } });
  if (recent >= 5) return { ok: true, message: `We've already sent this to ${email} today. Check your inbox (and spam folder).` };
  const enrol = await enrolment(email, tool);
  const lead = await db.lead.create({ data: { email, tool: tool.slug, data: { inputs, lines }, track: enrol.track, nextNurtureAt: enrol.nextNurtureAt } });

  const base = siteUrl();
  const table = `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${lines
    .map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#37443e">${esc(k)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${esc(v)}</td></tr>`)
    .join("")}</table>`;
  const { html, text } = layout({
    heading: `Your ${tool.title} results`,
    paragraphs: [inputs ? `Based on: ${esc(inputs)}` : "Here's your breakdown:", table],
    button: { label: tool.bonus.label, href: new URL(tool.bonus.href, base).toString() },
    after: [
      `Run it again any time: <a href="${new URL(`/tools/${tool.slug}`, base)}">${esc(tool.title)}</a>.`,
      `Want this worked out automatically every month? <a href="${new URL("/signup", base)}">BizBooks</a> does it for your whole company, free to start.`,
      "<span style=\"color:#6b746f;font-size:12px\">These figures are estimates based on the 2026 rules, not tax advice.</span>",
      ...(enrol.track !== "NONE" ? ["Over the next two weeks we'll send you a few short, practical guides on the same topic. You can unsubscribe with one click at any time."] : []),
    ],
    preview: "Your breakdown, plus a free guide to go with it.",
    footer: nurtureFooter(tool, lead.createdAt, lead.token),
  });
  const r = await sendEmail({ to: email, subject: `Your ${tool.title} results`, html, text, headers: unsubscribeHeaders(lead.token) });
  if (!r.ok) return { message: "We couldn't send the email just now. Please try again in a minute." };
  return { ok: true, message: `Sent to ${email}, with a free guide: ${tool.bonus.label}.` };
}
