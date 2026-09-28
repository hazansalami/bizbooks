import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeTotals, money, type LineInput } from "@/lib/money";
import { FREQUENCIES, INVOICE_STATUS } from "@/lib/constants";
import { dateInput, formatDate } from "@/lib/utils";
import { sendNextNow, setScheduleStatus } from "@/app/actions/recurring";
import { Badge, buttonClass, PageHeader, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { RecurringForm } from "@/components/recurring-form";

export const metadata = { title: "Recurring invoice" };

export default async function RecurringPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const { edit } = await searchParams;
  const s = await db.recurringSchedule.findFirst({ where: { id, businessId: business.id }, include: { customer: true, invoices: { orderBy: { issueDate: "desc" }, take: 24 } } });
  if (!s) notFound();
  const items = s.items as unknown as LineInput[];
  const t = computeTotals(items, s.discount, s.vatRate, s.whtRate);

  if (edit) {
    const customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    return (
      <>
        <PageHeader title={`Edit ${s.title}`} back={{ href: `/app/recurring/${id}`, label: s.title }} />
        <RecurringForm
          customers={customers} vatRegistered={business.vatRegistered} vatRate={business.vatRate} termsDays={business.paymentTermsDays}
          initial={{
            id: s.id, customerId: s.customerId, title: s.title, frequency: s.frequency, startAt: dateInput(s.nextRunAt),
            ends: s.maxRuns ? "after" : s.endAt ? "on" : "never", maxRuns: String(s.maxRuns ?? ""), endAt: dateInput(s.endAt),
            autoSend: s.autoSend, dueInDays: s.dueInDays, applyVat: s.vatRate > 0, whtRate: s.whtRate, notes: s.notes ?? "", items, currency: s.currency, exchangeRate: s.exchangeRate,
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={s.title}
        back={{ href: "/app/recurring", label: "Recurring" }}
        description={<>{s.customer.name} · {FREQUENCIES[s.frequency]} · <span className="num">{money(t.total, s.currency)}</span></>}
        actions={s.status !== "ENDED" ? <Link href={`/app/recurring/${id}?edit=1`} className={buttonClass("secondary")}>Edit</Link> : undefined}
      />
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {s.status === "ACTIVE" && <p className="text-lg">Next invoice: <strong>{formatDate(s.nextRunAt)}</strong></p>}
            {s.status === "PAUSED" && <p className="text-lg"><Badge tone="sun">Paused</Badge> No invoices will go out until you resume.</p>}
            {s.status === "ENDED" && <p className="text-lg"><Badge>Ended</Badge> This schedule has finished.</p>}
            <p className="mt-1 text-sm text-muted">
              {s.runs} sent so far{s.maxRuns ? ` of ${s.maxRuns}` : ""}{s.endAt ? ` · ends ${formatDate(s.endAt)}` : ""} · {s.autoSend ? "emailed automatically" : "you send each one"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.status === "ACTIVE" && (
              <>
                <form action={sendNextNow}><input type="hidden" name="id" value={s.id} /><button className={buttonClass("primary", "sm")}>Send next one now</button></form>
                <form action={setScheduleStatus}><input type="hidden" name="id" value={s.id} /><button name="status" value="PAUSED" className={buttonClass("secondary", "sm")}>Pause</button></form>
              </>
            )}
            {s.status === "PAUSED" && <form action={setScheduleStatus}><input type="hidden" name="id" value={s.id} /><button name="status" value="ACTIVE" className={buttonClass("primary", "sm")}>Resume</button></form>}
            {s.status !== "ENDED" && (
              <form action={setScheduleStatus}><input type="hidden" name="id" value={s.id} />
                <ConfirmButton name="status" value="ENDED" message="Stop this recurring invoice for good? Past invoices stay in your records." className={buttonClass("ghost", "sm", "text-danger")}>End</ConfirmButton>
              </form>
            )}
          </div>
        </div>
      </Panel>

      <h2 className="mb-3 mt-8 text-lg">Invoices from this schedule</h2>
      {s.invoices.length === 0 ? <p className="text-muted">The first one goes out on {formatDate(s.nextRunAt)}.</p> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {s.invoices.map((inv) => {
            const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.DRAFT;
            return (
              <li key={inv.id}>
                <Link href={`/app/invoices/${inv.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-canvas">
                  <span><span className="font-semibold">{inv.number}</span> <span className="text-sm text-muted">· {formatDate(inv.issueDate)}</span></span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
