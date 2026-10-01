"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { fieldErrors, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

const CustomerSchema = z.object({
  name: z.string().trim().min(2, "Enter the client's company or name."),
  contactName: z.string().trim(),
  tin: z.string().trim(),
  email: z.email("That email doesn't look right.").or(z.literal("")),
  phone: z.string().trim().regex(/^[+\d\s()-]{7,}$/, "Enter a phone number, e.g. 0803 123 4567.").or(z.literal("")),
  address: z.string().trim(),
  notes: z.string().trim(),
});

function read(form: FormData) {
  return Object.fromEntries(["name", "contactName", "email", "phone", "address", "tin", "notes"].map((k) => [k, str(form, k)])) as Record<string, string>;
}

export async function saveCustomer(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const values = read(form);
  const parsed = CustomerSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values };
  const d = parsed.data;
  const data = {
    name: d.name, contactName: d.contactName || null, email: d.email.toLowerCase() || null, phone: d.phone || null,
    address: d.address || null, tin: d.tin || null, notes: d.notes || null,
  };
  const id = str(form, "id");
  let customerId = id;
  if (id) {
    const existing = await db.customer.findFirst({ where: { id, businessId: business.id } });
    if (!existing) return { message: "Client not found." };
    await db.customer.update({ where: { id }, data });
  } else {
    customerId = (await db.customer.create({ data: { ...data, businessId: business.id } })).id;
  }
  revalidatePath("/app/customers");
  const next = str(form, "next");
  redirect(next === "invoice" ? `/app/invoices/new?customer=${customerId}` : `/app/customers/${customerId}`);
}

export async function deleteCustomer(form: FormData) {
  const { business } = await requireBusiness();
  const id = str(form, "id");
  const c = await db.customer.findFirst({ where: { id, businessId: business.id }, include: { _count: { select: { invoices: true } } } });
  if (!c) redirect("/app/customers");
  if (c._count.invoices > 0) redirect(`/app/customers/${id}?error=has-invoices`);
  // Deleting a client also deletes their recurring schedules, so make the owner end those deliberately first.
  if (await db.recurringSchedule.count({ where: { customerId: id, status: { in: ["ACTIVE", "PAUSED"] } } })) redirect(`/app/customers/${id}?error=has-recurring`);
  await db.customer.delete({ where: { id } });
  revalidatePath("/app/customers");
  redirect("/app/customers");
}
