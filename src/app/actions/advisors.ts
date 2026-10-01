"use server";

import { db } from "@/lib/db";
import { clientIp, recent, record } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { ADVISOR_SERVICES } from "@/lib/advisors";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

const KEYS = ADVISOR_SERVICES.map((s) => s.key as string);

export async function requestAdvisor(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const values = Object.fromEntries(["companyName", "contactName", "email", "phone", "teamSize", "message"].map((k) => [k, str(form, k)]));
  const services = form.getAll("services").map(String).filter((s) => KEYS.includes(s));
  const errors: Record<string, string> = {};
  if (values.companyName.length < 2) errors.companyName = "Enter your company's name.";
  if (values.contactName.length < 2) errors.contactName = "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Enter a valid email so we can reply.";
  if (!services.length) errors.services = "Choose at least one service.";
  // Honeypot: real people never fill this hidden field.
  if (str(form, "website")) return { ok: true, message: "Thanks, we'll be in touch." };
  if (Object.keys(errors).length) return { errors, values: { ...values, services: services.join(",") } };
  const ip = await clientIp();
  if ((await recent("ADVISOR_IP", ip, 60)) >= 5) return { message: "We've already got your request. An advisor will be in touch within one working day." };
  await record("ADVISOR_IP", ip);

  await db.advisorRequest.create({
    data: {
      businessId: user?.business?.id ?? null, companyName: values.companyName, contactName: values.contactName, email: values.email.toLowerCase(),
      phone: values.phone || null, services: services.join(","), teamSize: values.teamSize || null, message: values.message || null,
      source: str(form, "source") === "APP" ? "APP" : "WEBSITE",
    },
  });

  const to = process.env.ADVISORS_EMAIL;
  if (to) {
    const names = services.map((k) => ADVISOR_SERVICES.find((s) => s.key === k)?.name).join(", ");
    const { html, text } = layout({
      heading: `New advisory request: ${values.companyName}`,
      paragraphs: [
        `<strong>${esc(values.contactName)}</strong> · ${esc(values.email)}${values.phone ? ` · ${esc(values.phone)}` : ""}`,
        `Services: ${esc(names)}${values.teamSize ? ` · Team: ${esc(values.teamSize)}` : ""}`,
        values.message ? esc(values.message) : "No message.",
        user?.business ? "Already a BizBooks customer." : "From the website.",
      ],
    });
    await sendEmail({ to, subject: `Advisory request: ${values.companyName}`, html, text, replyTo: values.email });
  }
  return { ok: true, message: "Thank you. An advisor will contact you within one working day to book a free consultation." };
}
