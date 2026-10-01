"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, CheckCheck, Trash2, X } from "lucide-react";
import { bulkInvoiceAction } from "@/app/actions/invoices";
import { useFormAction, type FormState } from "./form-bits";
import { Badge, buttonClass, inputClass, Notice } from "./ui";
import { PAYMENT_METHODS } from "@/lib/constants";
import { cn, dateInput } from "@/lib/utils";

export type InvoiceRow = {
  id: string; customer: string; sub: string; amount: string;
  badge: { label: string; tone: "brand" | "sun" | "neutral" | "danger" | "info" };
  hasPayments: boolean; paidOnline: boolean; status: string;
};

/** The invoice list with bulk selection: mark paid, cancel or delete many at once. */
export function InvoiceList({ rows, toolbar, empty }: { rows: InvoiceRow[]; toolbar?: React.ReactNode; empty: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const { state, onSubmit, pending } = useFormAction<FormState>(bulkInvoiceAction, {});
  const [op, setOp] = useState("");

  // After a successful bulk action the list re-renders from the server; drop the selection.
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => { setSelected(new Set()); setPaying(false); }, 0);
    return () => clearTimeout(t);
  }, [state]);

  const ids = rows.map((r) => r.id);
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = rows.filter((r) => selected.has(r.id));
  const online = chosen.filter((r) => r.paidOnline).length;
  const withPayments = chosen.filter((r) => r.hasPayments || r.paidOnline).length;
  const [alsoPaid, setAlsoPaid] = useState(false);
  const openCount = chosen.filter((r) => !["PAID", "VOID"].includes(r.status)).length;

  return (
    <>
      {toolbar}
      {state.message && <Notice tone={state.ok ? "brand" : "danger"} className="mb-3">{state.message}</Notice>}
      {rows.length === 0 ? empty : (<>
      <div className="mb-2 flex items-center gap-3 px-1 text-sm">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 font-semibold text-ink-soft">
          <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(ids))} className="size-5 accent-brand" aria-label="Select all invoices shown" />
          Select all {rows.length > 1 ? `${rows.length} shown` : ""}
        </label>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
        {rows.map((r) => {
          const on = selected.has(r.id);
          return (
            <li key={r.id} className={cn("flex items-center", on && "bg-brand-wash/50")}>
              <label className="flex min-h-14 cursor-pointer items-center self-stretch pl-4 pr-1 sm:pl-5">
                <input type="checkbox" checked={on} onChange={() => toggle(r.id)} className="size-5 accent-brand" aria-label={`Select ${r.customer} ${r.sub.split(" · ")[0]}`} />
              </label>
              <Link href={`/app/invoices/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-2 pr-4 hover:bg-canvas sm:pr-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.customer}</p>
                  <p className="text-sm text-muted">{r.sub}</p>
                </div>
                <div className="text-right">
                  <p className="num font-bold">{r.amount}</p>
                  <Badge tone={r.badge.tone}>{r.badge.label}</Badge>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <form
          onSubmit={(e) => {
            // Each submit button carries its own op, so the action never depends on a state update landing first.
            const op = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? "";
            setOp(op);
            if (op === "delete") {
              const n = selected.size;
              if (!window.confirm(`Permanently delete ${n} invoice${n === 1 ? "" : "s"}? This can't be undone.`)) { e.preventDefault(); return; }
              // Second, separate confirmation before payments are removed from the books.
              const it = withPayments === 1 ? "it" : "them";
              const both = withPayments > 0 && window.confirm(
                `${withPayments} of these ${withPayments === 1 ? "has" : "have"} payments recorded. Delete ${it} too?

`
                + `The payments will be removed from your books as well.`
                + (online ? ` ${online} ${online === 1 ? "was" : "were"} paid online: deleting doesn't refund the client, so refund in Paystack or Flutterwave first if you need to.` : "")
                + `

OK: delete ${it} and the payments.
Cancel: keep ${it}${n > withPayments ? " and delete only the others" : ""}.`,
              );
              if (withPayments > 0 && !both && n === withPayments) { e.preventDefault(); return; }
              const flag = e.currentTarget.elements.namedItem("withPayments") as HTMLInputElement | null;
              if (flag) flag.value = both ? "1" : "";
              setAlsoPaid(both);
            }
            onSubmit(e);
          }}
          className="sticky bottom-20 z-20 mt-4 rounded-2xl border border-line bg-paper/95 p-3 shadow-lg backdrop-blur lg:bottom-4"
          aria-label="Bulk actions"
        >
          <input type="hidden" name="ids" value={JSON.stringify([...selected])} />
          <input type="hidden" name="withPayments" defaultValue={alsoPaid ? "1" : ""} />
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-semibold">{selected.size} selected</p>
            <button type="button" onClick={() => setPaying((p) => !p)} disabled={!openCount} aria-expanded={paying} className={buttonClass("primary", "sm")}>
              <CheckCheck className="size-4" aria-hidden /> Mark as paid
            </button>
            <button type="submit" name="op" value="void" disabled={pending || !openCount} className={buttonClass("secondary", "sm")}>
              <Ban className="size-4" aria-hidden /> Cancel
            </button>
            <button type="submit" name="op" value="delete" disabled={pending} className={buttonClass("secondary", "sm", "text-danger")}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
            <button type="button" onClick={() => { setSelected(new Set()); setPaying(false); }} aria-label="Clear selection" className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {paying && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Paid on</span>
                <input type="date" name="paidAt" defaultValue={dateInput(new Date())} className={cn(inputClass, "w-auto")} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">How</span>
                <select name="method" defaultValue="BANK_TRANSFER" className={cn(inputClass, "w-auto pr-8")}>
                  {Object.entries(PAYMENT_METHODS).filter(([k]) => k !== "PAYSTACK" && k !== "FLUTTERWAVE").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <button type="submit" name="op" value="paid" disabled={pending} className={buttonClass("primary", "sm")}>
                {pending && op === "paid" ? "Saving…" : `Record full payment on ${openCount} invoice${openCount === 1 ? "" : "s"}`}
              </button>
              <p className="w-full text-xs text-muted">Each invoice gets a payment for its outstanding balance. Paid and cancelled invoices are skipped.</p>
            </div>
          )}
          {!paying && (withPayments > 0 || online > 0 || openCount < selected.size) && (
            <p className="mt-2 text-xs text-muted">
              {withPayments > 0 && `${withPayments} selected ${withPayments === 1 ? "has" : "have"} payments recorded; you'll be asked twice before ${withPayments === 1 ? "it's" : "they're"} deleted with ${withPayments === 1 ? "its" : "their"} payments. `}
              Delete is permanent and only for invoices that were never real; Cancel keeps a record.
            </p>
          )}
        </form>
      )}
      </>)}
    </>
  );
}
