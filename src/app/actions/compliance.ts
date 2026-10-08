"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { DOC_KINDS, DOC_MAX_BYTES, DOC_TYPES, isDocKind, sniffType } from "@/lib/compliance";
import { dateOrNull, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

/** Opt in (or out). Documents stay saved when it's turned off; the page just hides. */
export async function setComplianceTracking(form: FormData) {
  const { business } = await requireBusiness();
  const on = str(form, "on") === "1";
  await db.business.update({ where: { id: business.id }, data: { complianceTracking: on } });
  revalidatePath("/app", "layout");
  redirect(on ? "/app/compliance" : "/app/taxes");
}

export async function uploadDocument(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const kind = str(form, "kind");
  const values = { kind, title: str(form, "title"), issuedAt: str(form, "issuedAt"), expiresAt: str(form, "expiresAt") };
  const errors: Record<string, string> = {};
  if (!isDocKind(kind)) errors.kind = "Choose what this document is.";
  if (kind === "OTHER" && values.title.length < 2) errors.title = "Give it a name, e.g. \"Fire safety certificate\".";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) errors.file = "Choose the file.";
  else if (file.size > DOC_MAX_BYTES) errors.file = "That file is over 3 MB. Scan at a lower resolution or save it as a smaller PDF.";
  const issuedAt = dateOrNull(form, "issuedAt");
  let expiresAt = dateOrNull(form, "expiresAt");
  // A TCC is valid to the end of the year it covers: fill that in when the owner leaves it blank.
  if (!expiresAt && kind === "TCC" && issuedAt) expiresAt = new Date(issuedAt.getFullYear(), 11, 31, 23, 59);
  if (expiresAt && issuedAt && expiresAt < issuedAt) errors.expiresAt = "The expiry date is before the issue date.";
  if (Object.keys(errors).length) return { errors, values };

  const f = file as File;
  const bytes = new Uint8Array(await f.arrayBuffer());
  const mimeType = sniffType(bytes);
  if (!mimeType || !DOC_TYPES[mimeType]) return { errors: { file: "Upload a PDF, PNG or JPEG file." }, values };
  const k = kind as keyof typeof DOC_KINDS;
  await db.companyDocument.create({
    data: {
      businessId: business.id, kind: k, title: (values.title || DOC_KINDS[k].label).slice(0, 120), fileName: f.name.slice(0, 200) || "document",
      mimeType, size: bytes.length, data: bytes, issuedAt, expiresAt,
    },
  });
  revalidatePath("/app/compliance");
  return { ok: true, message: `${DOC_KINDS[k].label} saved.` };
}

export async function deleteDocument(form: FormData) {
  const { business } = await requireBusiness();
  await db.companyDocument.deleteMany({ where: { id: str(form, "id"), businessId: business.id } });
  revalidatePath("/app/compliance");
}
