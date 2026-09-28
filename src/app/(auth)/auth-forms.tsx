"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, requestPasswordReset, resetPassword, signup } from "@/app/actions/auth";
import { SubmitButton, useFormAction, type FormState } from "@/components/form-bits";
import { Field, Input, Notice } from "@/components/ui";

function PasswordInput({ name, error, autoComplete }: { name: string; error?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required error={error} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink"
      >
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

export function SignupForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(signup, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Your name" name="fullName" error={e.fullName} required>
        <Input name="fullName" autoComplete="name" defaultValue={v.fullName} required error={e.fullName} />
      </Field>
      <Field label="Email address" name="email" error={e.email} required>
        <Input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={v.email} required error={e.email} />
      </Field>
      <Field label="Create a password" name="password" hint="At least 8 characters." error={e.password} required>
        <PasswordInput name="password" autoComplete="new-password" error={e.password} />
      </Field>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="terms" required aria-invalid={e.terms ? true : undefined} aria-describedby={e.terms ? "terms-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-brand" />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="font-semibold text-brand underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand underline">Privacy Policy</Link>, and understand that BizBooks provides
            software and general information, not tax, legal or accounting advice.
          </span>
        </label>
        {e.terms && <p id="terms-error" role="alert" className="mt-2 text-sm font-medium text-danger">{e.terms}</p>}
      </div>
      <SubmitButton size="lg" className="w-full" pending={pending} pendingText="Creating your account…">Create my free account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link>
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(login, {});
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {state.message && <Notice tone="danger">{state.message}</Notice>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email address" name="email" required>
        <Input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.values?.email} required />
      </Field>
      <Field label="Password" name="password" required>
        <PasswordInput name="password" autoComplete="current-password" />
      </Field>
      <p className="-mt-2 text-right text-sm"><Link href="/forgot-password" className="font-semibold text-brand hover:underline">Forgot your password?</Link></p>
      <SubmitButton size="lg" className="w-full" pending={pending} pendingText="Logging in…">Log in</SubmitButton>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-semibold text-brand hover:underline">Create a free account</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(requestPasswordReset, {});
  if (state.ok) {
    return (
      <div className="space-y-4">
        <Notice tone="brand">{state.message}</Notice>
        <p className="text-center text-sm text-muted"><Link href="/login" className="font-semibold text-brand hover:underline">Back to log in</Link></p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Email address" name="email" required error={state.errors?.email}>
        <Input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.values?.email} required error={state.errors?.email} />
      </Field>
      <SubmitButton size="lg" className="w-full" pending={pending} pendingText="Sending…">Email me a reset link</SubmitButton>
      <p className="text-center text-sm text-muted">Remembered it? <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link></p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(resetPassword, {});
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {state.message && (
        <Notice tone="danger">{state.message} <Link href="/forgot-password" className="font-semibold underline">Get a new link</Link></Notice>
      )}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" hint="At least 8 characters." error={e.password} required>
        <PasswordInput name="password" autoComplete="new-password" error={e.password} />
      </Field>
      <Field label="Type it again" name="confirm" error={e.confirm} required>
        <PasswordInput name="confirm" autoComplete="new-password" error={e.confirm} />
      </Field>
      <SubmitButton size="lg" className="w-full" pending={pending} pendingText="Saving…">Save new password and log in</SubmitButton>
    </form>
  );
}
