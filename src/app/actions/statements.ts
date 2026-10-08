"use server";

import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { emailStatement, isStatementPeriod } from "@/lib/client-statement";
import { str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

export async function emailStatementAction(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const c = await db.customer.findFirst({ where: { id: str(form, "customerId"), businessId: business.id }, select: { id: true } });
  if (!c) return { message: "Client not found." };
  const period = str(form, "period");
  const r = await emailStatement(business.id, c.id, isStatementPeriod(period) ? period : "all", str(form, "currency") || undefined);
  return r.ok ? { ok: true, message: `Statement emailed to ${r.to}.` } : { message: r.error };
}
