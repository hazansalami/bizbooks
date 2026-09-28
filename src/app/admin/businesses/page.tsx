import Link from "next/link";
import { loadBusinessRows } from "@/lib/admin";
import { Badge } from "@/components/ui";
import { nairaShort } from "@/lib/money";
import { cn, formatDate, timeAgo } from "@/lib/utils";

export const metadata = { title: "Businesses" };
export const dynamic = "force-dynamic";

const FILTERS = [["", "All"], ["pro", "Pro"], ["free", "Free"], ["risk", "At risk"], ["setup", "Not set up"]] as const;

export default async function AdminBusinesses({ searchParams }: { searchParams: Promise<{ q?: string; plan?: string; risk?: string; setup?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const active = sp.risk ? "risk" : sp.setup ? "setup" : sp.plan ?? "";
  let rows = await loadBusinessRows();
  if (q) rows = rows.filter((r) => [r.name, r.owner.email, r.owner.fullName, r.owner.phone ?? ""].some((v) => v.toLowerCase().includes(q)));
  if (active === "pro") rows = rows.filter((r) => r.pro);
  if (active === "free") rows = rows.filter((r) => !r.pro);
  if (active === "setup") rows = rows.filter((r) => !r.onboardedAt);
  if (active === "risk") rows = rows.filter((r) => r.riskLevel >= 2).sort((a, b) => b.riskLevel - a.riskLevel || Number(b.pro) - Number(a.pro));
  const href = (key: string) => (key === "risk" ? "?risk=1" : key === "setup" ? "?setup=1" : key ? `?plan=${key}` : "?");

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">Businesses</h1>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter businesses" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
          {FILTERS.map(([key, label]) => (
            <Link key={key} href={`/admin/businesses${href(key)}${q ? `${href(key) === "?" ? "" : "&"}q=${encodeURIComponent(q)}` : ""}`} aria-current={active === key ? "page" : undefined}
              className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold", active === key ? "bg-ink text-white" : "bg-paper text-ink-soft ring-1 ring-line hover:ring-ink")}>
              {label}
            </Link>
          ))}
        </nav>
        <form className="sm:w-72">
          {sp.plan && <input type="hidden" name="plan" value={sp.plan} />}
          {sp.risk && <input type="hidden" name="risk" value="1" />}
          <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" aria-label="Search businesses" className="min-h-11 w-full rounded-full border border-line-strong bg-paper px-4 text-sm" />
        </form>
      </div>
      <p className="mt-3 text-sm text-muted">{rows.length} business{rows.length === 1 ? "" : "es"}</p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Business</th>
              <th scope="col" className="px-4 py-3 font-semibold">Owner</th>
              <th scope="col" className="px-4 py-3 font-semibold">Plan</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Invoices</th>
              <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
              <th scope="col" className="px-4 py-3 font-semibold">Last active</th>
              <th scope="col" className="px-4 py-3 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top hover:bg-canvas/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/businesses/${r.id}`} className="font-semibold hover:underline">{r.name}</Link>
                  <p className="text-xs text-muted">{[r.industry, r.teamSize && `${r.teamSize} staff`].filter(Boolean).join(" · ") || "—"}</p>
                </td>
                <td className="px-4 py-3"><p>{r.owner.fullName}</p><p className="text-xs text-muted">{r.owner.email}</p></td>
                <td className="px-4 py-3"><Badge tone={r.pro ? "brand" : "neutral"}>{r.plan}</Badge>{r.proUntil && r.pro && <p className="mt-1 text-xs text-muted">to {formatDate(r.proUntil)}</p>}</td>
                <td className="num px-4 py-3 text-right">{r.invoiceCount}<p className="text-xs text-muted">{nairaShort(r.invoiceValue)}</p></td>
                <td className="whitespace-nowrap px-4 py-3">{formatDate(r.createdAt)}{!r.onboardedAt && <p className="text-xs text-sun-ink">Setup not finished</p>}</td>
                <td className="whitespace-nowrap px-4 py-3">{timeAgo(r.lastActiveAt)}</td>
                <td className="px-4 py-3">
                  {r.risks.length ? r.risks.map((x) => <p key={x.reason} className={cn("text-xs", x.level === 3 ? "font-semibold text-danger" : x.level === 2 ? "text-sun-ink" : "text-muted")}>{x.reason}</p>) : <span className="text-xs text-muted">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No businesses match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
