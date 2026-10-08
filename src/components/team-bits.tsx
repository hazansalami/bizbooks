"use client";

import { inviteAccountant } from "@/app/actions/team";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Input, Notice } from "./ui";

export function InviteForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(inviteAccountant, {});
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} key={state.ok ? state.message : "form"} className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-64 flex-1">
          <Input name="email" type="email" inputMode="email" aria-label="Accountant's email" placeholder="accountant@firm.com" defaultValue={state.ok ? "" : state.values?.email} error={e.email} />
          {e.email && <p className="mt-1 text-sm text-danger">{e.email}</p>}
        </div>
        <SubmitButton pending={pending} pendingText="Sending…">Send invitation</SubmitButton>
      </div>
      {state.message && <Notice tone={state.ok ? "brand" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
