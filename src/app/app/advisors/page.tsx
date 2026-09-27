import { Check } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { ADVISOR_SERVICES } from "@/lib/advisors";
import { naira } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Notice, PageHeader, Panel } from "@/components/ui";
import { AdvisorForm } from "@/components/advisor-form";

export const metadata = { title: "Advisors" };

export default async function AppAdvisors() {
  const { user, business } = await requireBusiness();
  const last = await db.advisorRequest.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Get expert help" description="Hand your bookkeeping, tax filings or payroll to the BizBooks advisory team. They work from the records you already keep here." />
      {last && <Notice tone="brand" className="mb-5">You asked for help on {formatDate(last.createdAt)}. An advisor will be in touch, or already has been. You can send another request below.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg">Book a free consultation</h2>
          <AdvisorForm source="APP" defaults={{ companyName: business.legalName || business.name, contactName: user.fullName, email: business.email || user.email, phone: business.phone ?? "", teamSize: business.teamSize ?? "" }} />
        </Panel>
        <div className="space-y-3">
          {ADVISOR_SERVICES.map((s) => (
            <Panel key={s.key} className="p-4">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm text-brand-deep">{s.from ? `From ${naira(s.from)} / month` : "Fixed quote"}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {s.includes.slice(0, 2).map((i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />{i}</li>)}
              </ul>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
