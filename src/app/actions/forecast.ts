"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { parseAmount, round2 } from "@/lib/money";
import { str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

/** The cash the company has today, across its bank accounts. The forecast starts from it. */
export async function setCashBalance(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const amount = parseAmount(str(form, "cashBalance"));
  if (!Number.isFinite(amount)) return { errors: { cashBalance: "Enter how much is in your bank accounts today, e.g. 2,450,000." }, values: { cashBalance: str(form, "cashBalance") } };
  await db.business.update({ where: { id: business.id }, data: { cashBalance: round2(amount), cashBalanceAt: new Date() } });
  revalidatePath("/app/forecast");
  revalidatePath("/app");
  return { ok: true, message: "Saved. The forecast now starts from this balance." };
}
