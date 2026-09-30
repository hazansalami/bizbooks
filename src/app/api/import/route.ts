import { grantTrialBonus } from "@/lib/growth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { importData, type ImportResult } from "@/lib/import/save";

// Big histories can be a few MB of JSON, more than a server action accepts, so this is a route.
export const maxDuration = 120;

const money = z.number().finite().min(-1e12).max(1e12);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max);
const opt = (max: number) => text(max).nullish();

const Body = z.object({
  source: z.enum(["WAVE", "ZOHO", "CSV"]),
  paidMode: z.enum(["paid", "unpaid"]),
  createItems: z.boolean(),
  continueNumbering: z.boolean(),
  customers: z.array(z.object({ name: text(200).min(1), email: opt(200), phone: opt(50), address: opt(500), contactName: opt(200), tin: opt(50) })).max(20000),
  invoices: z.array(z.object({
    number: text(60).min(1), customer: text(200).min(1), issueDate: date, dueDate: date.nullable(),
    lines: z.array(z.object({ name: text(300).min(1), details: opt(4000), quantity: money, unitPrice: money, amount: money })).min(1).max(500),
    discount: money, vatAmount: money, total: money, paid: money.nullable(),
    status: z.enum(["PAID", "PARTIAL", "UNPAID", "DRAFT", "VOID"]).nullable(),
    payments: z.array(z.object({ date, amount: money })).max(200),
    poNumber: opt(100), notes: opt(4000),
  })).max(20000),
  recurring: z.array(z.object({
    customer: text(200).min(1), title: text(200).min(1), frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    nextDate: date, endDate: date.nullable(), origin: z.enum(["file", "detected"]),
    lines: z.array(z.object({ name: text(300).min(1), details: opt(4000), quantity: money, unitPrice: money, amount: money })).min(1).max(200),
    discount: money, vatAmount: money, total: money,
  })).max(1000),
  recurringActive: z.boolean(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.business) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const issue = e instanceof z.ZodError ? e.issues[0] : null;
    return NextResponse.json({ error: issue ? `Something in the file didn't look right (${issue.path.join(".")}: ${issue.message}).` : "We couldn't read that upload." }, { status: 400 });
  }
  try {
    const result: ImportResult = await importData(user.business.id, body);
    if (result.invoicesCreated > 0) await grantTrialBonus(user.business.id, "PAYROLL_OR_IMPORT");
    return NextResponse.json(result);
  } catch (e) {
    console.error("import", e);
    return NextResponse.json({ error: "The import failed and nothing was saved. Please try again, or send us the file." }, { status: 500 });
  }
}
