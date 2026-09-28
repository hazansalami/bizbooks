import { Check, Minus } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { COMPARE_ROWS, RIVALS, type Cell, type Rival } from "@/lib/compare";
import { cn } from "@/lib/utils";

function Value({ v, strong }: { v: Cell; strong?: boolean }) {
  if (v === true) return <Check className="size-5 text-brand" aria-label="Yes" />;
  if (v === false) return <Minus className="size-5 text-muted/60" aria-label="No" />;
  return <span className={cn("text-sm", strong ? "font-medium text-ink" : "text-ink-soft")}>{v}</span>;
}

/** BizBooks against one or more rivals. `homeOnly` keeps the homepage version short. */
export function CompareTable({ rivals, homeOnly = false }: { rivals: Rival[]; homeOnly?: boolean }) {
  const rows = homeOnly ? COMPARE_ROWS.filter((r) => r.home) : COMPARE_ROWS;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className={cn("w-full text-left text-sm", rivals.length > 1 ? "min-w-[44rem]" : "min-w-[34rem]")}>
        <thead className="bg-canvas">
          <tr>
            <th scope="col" className="w-2/5 p-4 font-semibold"><span className="sr-only">Feature</span></th>
            <th scope="col" className="p-4 font-bold text-brand-deep">{APP_NAME}</th>
            {rivals.map((r) => <th key={r} scope="col" className="p-4 font-semibold">{RIVALS[r].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line align-top">
              <th scope="row" className="p-4 font-medium">{row.label}</th>
              <td className="bg-brand-wash/40 p-4"><Value v={row.bizbooks} strong /></td>
              {rivals.map((r) => <td key={r} className="p-4"><Value v={row[r]} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
