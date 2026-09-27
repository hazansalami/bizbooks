import { ExternalLink, ShieldCheck } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDERS, type Provider } from "@/lib/gateways";
import { siteUrl } from "@/lib/site-url";
import { formatDate } from "@/lib/utils";
import { bankAction, gatewayAction } from "@/app/actions/settings";
import { Badge, buttonClass, Notice, PageHeader, Panel } from "@/components/ui";
import { ConfirmButton, CopyButton } from "@/components/form-bits";
import { AddBankForm, ConnectGatewayForm } from "@/components/settings-forms";

export const metadata = { title: "How you get paid" };

export default async function PaymentSettings() {
  const { business } = await requireBusiness();
  const [banks, gateways] = await Promise.all([
    db.bankAccount.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } }),
    db.gateway.findMany({ where: { businessId: business.id } }),
  ]);

  return (
    <>
      <PageHeader title="How you get paid" back={{ href: "/app/settings", label: "Settings" }} />
      <Notice tone="brand" className="mb-6">
        <span className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Customers pay straight into your own accounts. BizBooks never receives or holds your money. Secret keys are encrypted and can be removed at any time.</span>
      </Notice>

      <Panel className="p-5 sm:p-6">
        <h2 className="text-lg">Bank accounts</h2>
        <p className="text-sm text-muted">Shown on every invoice with a copy button. The default one appears first and in WhatsApp messages.</p>
        {banks.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {banks.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="font-semibold">{a.bankName} · <span className="num">{a.accountNumber}</span> {a.isDefault && <Badge tone="brand">Default</Badge>}</p>
                  <p className="text-sm text-muted">{a.accountName}</p>
                </div>
                <form action={bankAction} className="flex gap-1">
                  <input type="hidden" name="id" value={a.id} />
                  {!a.isDefault && <button name="op" value="default" className={buttonClass("ghost", "sm")}>Make default</button>}
                  <ConfirmButton name="op" value="remove" message="Remove this bank account from future invoices?" className={buttonClass("ghost", "sm", "text-danger")}>Remove</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5"><AddBankForm /></div>
      </Panel>

      {(["PAYSTACK", "FLUTTERWAVE"] as Provider[]).map((provider) => {
        const g = gateways.find((x) => x.provider === provider);
        const info = PROVIDERS[provider];
        const webhook = new URL(`/api/webhooks/${provider.toLowerCase()}/${business.id}`, siteUrl()).toString();
        return (
          <Panel key={provider} className="mt-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg">{info.name}</h2>
              {g ? (
                <div className="flex items-center gap-2">
                  <Badge tone={g.enabled ? "brand" : "neutral"}>{g.enabled ? "Connected" : "Turned off"}</Badge>
                  {g.mode === "TEST" && <Badge tone="sun">Test mode</Badge>}
                </div>
              ) : <Badge>Not connected</Badge>}
            </div>
            {g && (
              <>
                <p className="mt-1 text-sm text-muted">Key checked {formatDate(g.verifiedAt)}.</p>
                {g.mode === "TEST" && <Notice tone="sun" className="mt-3">You're using a test key, so customers can't make real payments. Paste your live secret key below when you're ready.</Notice>}
                <div className="mt-4 rounded-xl bg-canvas p-4 text-sm">
                  <p className="font-semibold">Recommended: add this webhook URL in {info.name}</p>
                  <p className="mt-1 text-ink-soft">
                    {provider === "PAYSTACK" ? "Settings → API Keys & Webhooks → Live Webhook URL." : "Settings → Webhooks. Also set the same secret hash you enter below."}{" "}
                    It confirms payments even if the customer closes their browser too early.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2 text-xs ring-1 ring-line">{webhook}</code>
                    <CopyButton text={webhook} />
                  </div>
                </div>
                <form action={gatewayAction} className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <button name="op" value={g.enabled ? "disable" : "enable"} className={buttonClass("secondary", "sm")}>{g.enabled ? "Turn off “Pay now” button" : "Turn back on"}</button>
                  <ConfirmButton name="op" value="remove" message={`Disconnect ${info.name}? We'll delete your saved keys.`} className={buttonClass("ghost", "sm", "text-danger")}>Disconnect</ConfirmButton>
                </form>
              </>
            )}
            <div className="mt-5 border-t border-line pt-5">
              <ConnectGatewayForm provider={provider} connected={!!g} />
              <a href={info.keysUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand hover:underline">
                Find your keys on {info.name} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </Panel>
        );
      })}
    </>
  );
}
