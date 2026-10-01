"use client";

import { useState } from "react";
import { BadgeCheck, CircleAlert, ShieldCheck } from "lucide-react";
import { activatePayments, checkBankAccount, setPaymentsOn } from "@/app/actions/payments";
import { SubmitButton, useFormAction, type FormState } from "./form-bits";
import { Badge, buttonClass, Field, Input, Notice, Select } from "./ui";
import { cn } from "@/lib/utils";

type Account = { bankName: string; accountNumber: string; accountName: string; status: string; reviewNote: string | null; feeFreeLeft: number; pending: string | null };

export function PaymentsSetup({ banks, account, hasRc, fee }: {
  banks: { name: string; code: string }[];
  account: Account | null;
  hasRc: boolean;
  fee: { amount: string; freeBelow: string; paystack: string };
}) {
  const [editing, setEditing] = useState(!account || account.status === "DISABLED");
  const statusBadge: Record<string, React.ReactNode> = {
    ACTIVE: <Badge tone="brand">On</Badge>,
    PENDING_REVIEW: <Badge tone="sun">Being checked</Badge>,
    DISABLED: <Badge>Off</Badge>,
    SUSPENDED: <Badge tone="danger">Paused by BizBooks</Badge>,
  };

  return (
    <div>
      {account && (
        <div className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{account.bankName} · <span className="num">••{account.accountNumber.slice(-4)}</span></p>
              <p className="text-sm text-muted">{account.accountName}</p>
            </div>
            {statusBadge[account.status]}
          </div>
          {account.status === "ACTIVE" && (
            <p className="mt-2 text-sm text-ink-soft">
              Your invoices have a “Pay now” button. Money settles straight to this account.
              {account.feeFreeLeft > 0 && <> <strong className="text-brand-deep">{account.feeFreeLeft} fee-free payment{account.feeFreeLeft === 1 ? "" : "s"} left.</strong></>}
            </p>
          )}
          {account.status === "PENDING_REVIEW" && (
            <p className="mt-2 text-sm text-sun-ink">
              {account.pending && <>Requested change to <strong>{account.pending}</strong>. </>}
              {account.reviewNote} We check these by hand, usually within one working day. Online payments are paused meanwhile; clients can still pay by bank transfer.
            </p>
          )}
          {(account.status === "SUSPENDED" || account.status === "DISABLED") && account.reviewNote && <p className="mt-2 text-sm text-danger">{account.reviewNote}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!editing && account.status !== "SUSPENDED" && <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "sm")}>Change payout account</button>}
            {(account.status === "ACTIVE" || (account.status === "DISABLED" && !account.reviewNote)) && (
              <form action={setPaymentsOn}>
                <input type="hidden" name="on" value={account.status === "ACTIVE" ? "0" : "1"} />
                <button className={buttonClass("ghost", "sm")}>{account.status === "ACTIVE" ? "Turn off" : "Turn back on"}</button>
              </form>
            )}
          </div>
        </div>
      )}

      {editing && account?.status !== "SUSPENDED" && (
        hasRc ? <SetupForm banks={banks} fee={fee} changing={!!account} onDone={() => setEditing(false)} /> : (
          <Notice tone="sun" className="mt-4">BizBooks Payments is for registered businesses. Add your CAC number (RC or BN) in <a href="/app/settings" className="font-semibold underline">Settings</a> first.</Notice>
        )
      )}
    </div>
  );
}

function SetupForm({ banks, fee, changing, onDone }: { banks: { name: string; code: string }[]; fee: { amount: string; freeBelow: string; paystack: string }; changing: boolean; onDone: () => void }) {
  const check = useFormAction<FormState>(checkBankAccount, {});
  const activate = useFormAction<FormState>(activatePayments, {});
  const checked = check.state.ok ? check.state.values : undefined;
  const e = { ...check.state.errors, ...activate.state.errors };

  if (activate.state.ok) {
    return <Notice tone="brand" className="mt-4">{activate.state.message} <button type="button" onClick={onDone} className="font-semibold underline">Done</button></Notice>;
  }

  return (
    <div className="mt-4 space-y-4">
      <form onSubmit={check.onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Bank" name="bankCode" required error={e.bankCode}>
          <Select name="bankCode" defaultValue={check.state.values?.bankCode ?? ""} error={e.bankCode}>
            <option value="" disabled>Choose your bank</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Business account number" name="accountNumber" required error={e.accountNumber}>
          <Input name="accountNumber" inputMode="numeric" maxLength={10} autoComplete="off" placeholder="10 digits" defaultValue={check.state.values?.accountNumber} error={e.accountNumber} className="num" />
        </Field>
        <SubmitButton variant="secondary" pending={check.pending} pendingText="Checking…">Check account</SubmitButton>
      </form>

      {checked?.accountName && (
        <form onSubmit={activate.onSubmit} className="space-y-4 rounded-xl bg-canvas p-4" noValidate>
          <input type="hidden" name="bankCode" value={checked.bankCode} />
          <input type="hidden" name="accountNumber" value={checked.accountNumber} />
          <p className={cn("flex items-start gap-2 font-semibold", checked.matches === "yes" ? "text-brand-deep" : "text-sun-ink")}>
            {checked.matches === "yes" ? <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />}
            <span>
              {checked.accountName}
              <span className="block text-sm font-normal text-ink-soft">
                {checked.matches === "yes"
                  ? "Matches your business. Payments can start straight away."
                  : "This name doesn't match your business name. You can continue, but we'll check it by hand first (usually within one working day). Settlement accounts must belong to the business."}
              </span>
            </span>
          </p>
          <div className="rounded-xl border border-line bg-paper p-3 text-sm text-ink-soft">
            <p className="font-semibold text-ink">What it costs</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li><strong>{fee.amount} BizBooks fee</strong> per successful payment, VAT included. No fee on payments under {fee.freeBelow}.</li>
              <li>Paystack&apos;s standard fee ({fee.paystack}), the same as on your own Paystack account.</li>
              <li>Both come off before settlement and are recorded in your expenses automatically.</li>
            </ul>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="terms" className="mt-0.5 size-5 accent-brand" />
            <span>
              I confirm this account belongs to the business, and I agree to the <a href="/terms#payments" target="_blank" className="font-semibold text-brand underline">BizBooks Payments terms</a> and fees. Payments are processed by Paystack and settle directly to this account; BizBooks never holds the money.
            </span>
          </label>
          {e.terms && <p role="alert" className="text-sm font-medium text-danger">{e.terms}</p>}
          {activate.state.message && !activate.state.ok && <Notice tone="danger">{activate.state.message}</Notice>}
          <SubmitButton pending={activate.pending} pendingText="Setting up…">{changing ? "Use this account" : "Turn on BizBooks Payments"}</SubmitButton>
        </form>
      )}
      <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> We check account names with your bank through Paystack. Any change of payout account is emailed to the business owner.</p>
    </div>
  );
}
