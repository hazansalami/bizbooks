"use client";

import { startTransition, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "./ui";
import { cn } from "@/lib/utils";

export type FormState = { errors?: Record<string, string>; values?: Record<string, string>; message?: string; ok?: boolean };

/**
 * Like useActionState, but submits via onSubmit so React does not reset the form afterwards.
 * Owners keep everything they typed when validation fails.
 */
export function useFormAction<S extends object>(fn: (state: S, form: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(fn, initial as Awaited<S>);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
  return { state, onSubmit, pending };
}

export function SubmitButton({
  children, pendingText, variant = "primary", size = "md", className, name, value, pending: pendingProp,
}: {
  children: React.ReactNode; pendingText?: string; variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1]; className?: string; name?: string; value?: string; pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? (
        <>
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingText ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ConfirmButton({ message, children, className, name, value }: { message: string; children: React.ReactNode; className?: string; name?: string; value?: string }) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cn(buttonClass("secondary", "sm"), className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {}
      }}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

export function PrintButton({ className, children = "Download PDF" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={className ?? buttonClass("secondary", "md")}>
      {children}
    </button>
  );
}
