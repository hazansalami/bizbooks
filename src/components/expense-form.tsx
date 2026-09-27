"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, Repeat, X } from "lucide-react";
import { saveExpense } from "@/app/actions/expenses";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Select } from "./ui";
import { EXPENSE_CATEGORIES, FREQUENCIES, PAYMENT_METHODS, PAYROLL_CATEGORIES } from "@/lib/constants";
import { cn, dateInput } from "@/lib/utils";

/** Phone photos are 3–5 MB; a 1000px JPEG at 70% is ~100 KB and still readable. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExpenseForm({ initial, vatRegistered }: { initial?: Record<string, string> & { id: string }; vatRegistered: boolean }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveExpense, {});
  const e = state.errors ?? {};
  const v = state.ok ? {} : { ...initial, ...state.values };
  const [category, setCategory] = useState(v.category ?? "");
  const [receipt, setReceipt] = useState(initial?.receipt ?? "");
  const [repeat, setRepeat] = useState(false);
  const [status, setStatus] = useState(v.status || (initial && initial.paid === "no" ? "bill" : "paid"));
  const [frequency, setFrequency] = useState("MONTHLY");
  // Remount the inputs after "save and add another" so they clear.
  const formKey = state.ok ? state.values?.nonce : "form";
  const categories = EXPENSE_CATEGORIES.filter((c) => !PAYROLL_CATEGORIES.includes(c) || c === initial?.category);

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="receipt" value={receipt.startsWith("data:") ? receipt : ""} />
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
      <fieldset>
        <legend className="sr-only">Paid already?</legend>
        <input type="hidden" name="status" value={status} />
        <div className="grid grid-cols-2 gap-2">
          {[["paid", "Paid already", "An expense"], ["bill", "Not paid yet", "A bill to pay later"]].map(([val, label, sub]) => (
            <button key={val} type="button" aria-pressed={status === val} disabled={!!initial && initial.paid === "yes" && val === "bill"} onClick={() => setStatus(val)}
              className={cn("min-h-14 rounded-xl border px-3 py-2 text-left disabled:opacity-50", status === val ? "border-brand bg-brand-wash ring-2 ring-brand/30" : "border-line-strong")}>
              <span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted">{sub}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Amount (₦)" name="amount" required error={e.amount}>
          <Input name="amount" inputMode="decimal" autoFocus defaultValue={v.amount} error={e.amount} className="num text-lg" />
        </Field>
        <Field label={status === "bill" ? "Bill date" : "Date"} name="date" required error={e.date}>
          <Input name="date" type="date" defaultValue={v.date ?? dateInput(new Date())} error={e.date} />
        </Field>
        {status === "bill" && (
          <Field label="Due date" name="dueDate" required error={e.dueDate}>
            <Input name="dueDate" type="date" defaultValue={v.dueDate} error={e.dueDate} />
          </Field>
        )}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">What was it for?</legend>
        <input type="hidden" name="category" value={category} />
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
              className={cn("min-h-10 rounded-full border px-3.5 text-sm font-medium", category === c ? "border-brand bg-brand text-white" : "border-line-strong hover:border-ink")}>
              {c}
            </button>
          ))}
        </div>
        {e.category && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.category}</p>}
        <p className="mt-2 text-sm text-muted">Paying salaries? Use <Link href="/app/payroll" className="font-semibold text-brand hover:underline">Payroll</Link>. It records them for you with PAYE and pension.</p>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Paid to" name="vendor"><Input name="vendor" defaultValue={v.vendor} placeholder="e.g. Google Workspace, landlord, IKEDC" /></Field>
        <Field label="Paid by" name="method">
          <Select name="method" defaultValue={v.method ?? "BANK_TRANSFER"}>
            {["BANK_TRANSFER", "CASH", "POS", "OTHER"].map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m]}</option>)}
          </Select>
        </Field>
        <Field label="Note" name="note" className="sm:col-span-2"><Input name="note" defaultValue={v.note} /></Field>
        {vatRegistered && (
          <Field label="VAT included (₦)" name="vatAmount" error={e.vatAmount} hint="If the supplier's invoice shows VAT, you can usually offset it against the VAT you collect.">
            <Input name="vatAmount" inputMode="decimal" defaultValue={v.vatAmount} error={e.vatAmount} className="num" />
          </Field>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">Receipt or invoice <span className="font-normal text-muted">(optional)</span></p>
        {receipt ? (
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt} alt="Receipt" className="h-28 rounded-lg border border-line object-contain" />
            <button type="button" onClick={() => setReceipt("")} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-danger hover:bg-danger-wash"><X className="size-4" aria-hidden />Remove</button>
          </div>
        ) : (
          <label className="mt-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 hover:border-ink">
            <Camera className="size-5 text-brand" aria-hidden />
            <span className="text-sm"><span className="font-semibold">Snap or upload the receipt</span><span className="block text-muted">Kept with the expense for your accountant and the tax office.</span></span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) setReceipt(await shrinkPhoto(f)); }} />
          </label>
        )}
        {e.receipt && <p role="alert" className="mt-2 text-sm font-medium text-danger">{e.receipt}</p>}
      </div>

      {!initial && (
        <div className="rounded-xl bg-canvas p-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="repeat" checked={repeat} onChange={(ev) => setRepeat(ev.target.checked)} className="mt-1 size-5 accent-brand" />
            <span><span className="flex items-center gap-1.5 font-semibold"><Repeat className="size-4" aria-hidden />This is a regular cost</span><span className="block text-sm text-muted">Rent, software, internet, retainers… BizBooks logs it for you each time.</span></span>
          </label>
          {repeat && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="title" hint="e.g. Office rent"><Input name="title" defaultValue={v.title} /></Field>
              <Field label="Repeats" name="frequency" error={e.frequency}>
                <input type="hidden" name="frequency" value={frequency} />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FREQUENCIES).map(([val, label]) => (
                    <button key={val} type="button" aria-pressed={frequency === val} onClick={() => setFrequency(val)} className={cn("min-h-10 rounded-full border px-3 text-sm font-medium", frequency === val ? "border-brand bg-brand-wash text-brand-deep" : "border-line-strong")}>{label}</button>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton size="lg" pending={pending}>{initial ? "Save changes" : repeat ? "Save and repeat" : status === "bill" ? "Save bill" : "Save expense"}</SubmitButton>
        {!initial && !repeat && <SubmitButton size="lg" variant="secondary" name="intent" value="another" pending={pending}>Save and add another</SubmitButton>}
      </div>
    </form>
  );
}
