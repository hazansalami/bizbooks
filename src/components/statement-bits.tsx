"use client";

import { Mail } from "lucide-react";
import { emailStatementAction } from "@/app/actions/statements";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Notice } from "./ui";

export function EmailStatement({ customerId, period, currency, email }: { customerId: string; period: string; currency: string; email: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(emailStatementAction, {});
  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="currency" value={currency} />
      <SubmitButton size="sm" variant="secondary" pending={pending} pendingText="Sending…"><Mail className="size-4" aria-hidden /> Email to {email}</SubmitButton>
      {state.message && <Notice tone={state.ok ? "brand" : "danger"} className="w-full">{state.message}</Notice>}
    </form>
  );
}
