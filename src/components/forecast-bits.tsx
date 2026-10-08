"use client";

import { setCashBalance } from "@/app/actions/forecast";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Input, Notice } from "./ui";

/** "How much is in the bank today?": the forecast's starting point. */
export function CashBalanceForm({ current }: { current: number | null }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(setCashBalance, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-semibold">
        Cash in the bank today (₦)
        <Input name="cashBalance" inputMode="decimal" defaultValue={state.values?.cashBalance ?? (current != null ? String(current) : "")} error={state.errors?.cashBalance} placeholder="e.g. 2,450,000" className="num mt-1 w-56" />
      </label>
      <SubmitButton size="sm" pending={pending}>{current != null ? "Update" : "Start the forecast"}</SubmitButton>
      {state.errors?.cashBalance && <p className="w-full text-sm text-danger">{state.errors.cashBalance}</p>}
      {state.ok && state.message && <Notice tone="brand" className="w-full">{state.message}</Notice>}
    </form>
  );
}
