"use client";

import { useState } from "react";
import { uploadDocument } from "@/app/actions/compliance";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Field, Input, Notice, Select } from "./ui";

type Kind = { key: string; label: string; hint: string; expires: boolean };

/** Upload one document. The hint and expiry field follow the kind chosen. */
export function DocumentUpload({ kinds, suggested }: { kinds: Kind[]; suggested?: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(uploadDocument, {});
  const [kind, setKind] = useState(state.values?.kind ?? suggested ?? kinds[0].key);
  const k = kinds.find((x) => x.key === kind) ?? kinds[0];
  const e = state.errors ?? {};
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <form onSubmit={onSubmit} key={state.ok ? state.message : "form"} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Document" name="kind" error={e.kind} required>
          <Select name="kind" value={kind} onChange={(ev) => setKind(ev.target.value)} error={e.kind}>
            {kinds.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </Select>
        </Field>
        <Field label="Name" name="title" error={e.title} required={kind === "OTHER"}>
          <Input name="title" defaultValue={v.title} error={e.title} placeholder={kind === "OTHER" ? "e.g. Fire safety certificate" : k.label} />
        </Field>
        <Field label="Issued on" name="issuedAt">
          <Input name="issuedAt" type="date" defaultValue={v.issuedAt} />
        </Field>
        {k.expires && (
          <Field label="Valid until" name="expiresAt" error={e.expiresAt} hint={kind === "TCC" ? "Leave blank for 31 December of the year it was issued." : undefined}>
            <Input name="expiresAt" type="date" defaultValue={v.expiresAt} error={e.expiresAt} />
          </Field>
        )}
      </div>
      <p className="text-sm text-muted">{k.hint}</p>
      <div>
        <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required aria-label="File" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-wash file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-deep" />
        <p className="mt-1 text-xs text-muted">PDF, PNG or JPEG, up to 3 MB.</p>
        {e.file && <p className="mt-1 text-sm text-danger">{e.file}</p>}
      </div>
      <SubmitButton size="sm" pending={pending} pendingText="Uploading…">Save document</SubmitButton>
      {state.ok && state.message && <Notice tone="brand">{state.message}</Notice>}
    </form>
  );
}
