"use client";

import { Mail } from "lucide-react";
import { emailPayslips } from "@/app/actions/payroll";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Notice } from "./ui";

export function EmailPayslips({ id }: { id: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(emailPayslips, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" size="sm" pending={pending} pendingText="Sending…"><Mail className="size-4" aria-hidden /> Email payslips to the team</SubmitButton>
      {state.message && <Notice tone={state.ok ? "brand" : "sun"} className="py-2">{state.message}</Notice>}
    </form>
  );
}
