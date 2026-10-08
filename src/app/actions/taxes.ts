"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { parseAmount, round2 } from "@/lib/money";
import { str } from "@/lib/utils";

export async function markTaxFiled(form: FormData) {
  const { business } = await requireBusiness();
  const kind = str(form, "kind");
  const period = str(form, "period");
  if (!["VAT", "PAYE", "PENSION", "WHT"].includes(kind) || !/^\d{4}-\d{2}$/.test(period)) return;
  const amount = round2(parseAmount(str(form, "amount")) || 0);
  await db.taxFiling.upsert({
    where: { businessId_kind_period: { businessId: business.id, kind, period } },
    create: { businessId: business.id, kind, period, amount, reference: str(form, "reference") || null },
    update: { amount, reference: str(form, "reference") || null, paidAt: new Date() },
  });
  revalidatePath("/app/taxes", "layout");
  revalidatePath("/app");
}

export async function unmarkTaxFiled(form: FormData) {
  const { business } = await requireBusiness();
  await db.taxFiling.deleteMany({ where: { businessId: business.id, kind: str(form, "kind"), period: str(form, "period") } });
  revalidatePath("/app/taxes", "layout");
}
