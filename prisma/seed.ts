/*
  Demo data: `npm run db:seed` creates a demo digital agency with 12 months of invoices, payments,
  bills, recurring costs and payroll, so every screen and report has something to show.
  Login: demo@bizbooks.test with the SEED_DEMO_PASSWORD from your .env. All names are fictional.
*/
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computePay, payDateFor, periodOf } from "../src/lib/payroll";

/** payeStatus is display-only; pay items store the amounts. */
function withoutStatus<T extends { payeStatus: unknown }>(p: T): Omit<T, "payeStatus"> {
  const { payeStatus, ...rest } = p;
  void payeStatus;
  return rest;
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const token = () => randomBytes(18).toString("base64url");
const monthsAgo = (n: number, day: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); d.setDate(day); return d; };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const email = "demo@bizbooks.test";
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("Set SEED_DEMO_PASSWORD in .env first");
  // Invoices restrict client deletion, so clear them before the cascade from the user.
  await db.invoice.deleteMany({ where: { business: { owner: { email } } } });
  await db.user.deleteMany({ where: { email } });
  const user = await db.user.create({ data: { email, fullName: "Kemi Adebayo", passwordHash: await bcrypt.hash(password, 10) } });
  const b = await db.business.create({
    data: {
      ownerId: user.id, name: "Northwind Creative", legalName: "Northwind Creative Ltd", entityType: "LTD", rcNumber: "1847263", teamSize: "11–50",
      industry: "Digital & creative agency", email, phone: "08031234567", address: "14 Admiralty Way", city: "Lekki", state: "Lagos",
      tin: "21847263-0001", vatRegistered: true, paymentTermsDays: 30, payDay: 25, onboardingStep: 5, onboardedAt: new Date(),
      plan: "PRO", proUntil: addDays(new Date(), 200),
      bankAccounts: { create: { bankName: "GTBank", accountNumber: "0123456789", accountName: "Northwind Creative Ltd", isDefault: true } },
    },
  });

  const clients = await Promise.all([
    ["Harbour Logistics Ltd", "Tolu Bello", "accounts@harbourlogistics.test", "30112233-0001"],
    ["Lagoon Retail Plc", "Ngozi Eze", "payables@lagoonretail.test", "20998877-0001"],
    ["Savanna Microfinance Bank", "Ibrahim Musa", "finance@savannamfb.test", "18776655-0001"],
    ["Crestview Schools", "Mrs. Funmi Ade", "bursar@crestview.test", null],
  ].map(([name, contactName, mail, tin]) => db.customer.create({ data: { businessId: b.id, name: name!, contactName, email: mail, tin } })));

  // Invoices over the last 12 months: retainers and projects, 7.5% VAT, most clients deduct 5% WHT.
  let n = 1;
  const invoice = async (c: number, monthsBack: number, desc: string, amount: number, paidPart: number) => {
    const issue = monthsAgo(monthsBack, 3);
    const subtotal = amount, vat = r2(amount * 0.075), wht = c === 3 ? 0 : r2(amount * 0.05), total = r2(subtotal + vat);
    const payable = r2(total - wht), paid = r2(payable * paidPart);
    const status = paidPart >= 1 ? "PAID" : paidPart > 0 ? "PARTIAL" : "SENT";
    const inv = await db.invoice.create({
      data: {
        businessId: b.id, customerId: clients[c].id, number: `INV-${String(n++).padStart(4, "0")}`, status, issueDate: issue, dueDate: addDays(issue, 30),
        poNumber: c < 2 ? `PO-${4400 + n}` : null, subtotal, vatRate: 7.5, vatAmount: vat, whtRate: c === 3 ? 0 : 5, whtAmount: wht, total, amountPaid: paid,
        publicToken: token(), sentAt: issue, paidAt: status === "PAID" ? addDays(issue, 24) : null,
        items: { create: [{ description: desc, quantity: 1, unitPrice: amount, amount, position: 0 }] },
        events: { create: [{ type: "CREATED" }, { type: "SENT", note: `Emailed ${clients[c].email}` }] },
      },
    });
    if (paid > 0) await db.payment.create({ data: { businessId: b.id, invoiceId: inv.id, amount: paid, method: c === 1 ? "PAYSTACK" : "BANK_TRANSFER", paidAt: addDays(issue, 24), reference: c === 1 ? `bb-${inv.id}-seed` : null } });
  };
  for (let m = 11; m >= 1; m--) await invoice(0, m, "Monthly social media & content retainer", 1_250_000, 1);
  for (let m = 11; m >= 2; m -= 3) await invoice(1, m, "Quarterly campaign: creative, media buying and reporting", 3_120_000, 1);
  await invoice(2, 8, "Brand identity and website redesign: phase 1", 4_500_000, 1);
  await invoice(2, 4, "Website redesign: phase 2 (build and launch)", 5_800_000, 0.5);
  await invoice(3, 2, "Admissions campaign videos", 1_300_000, 0);
  await invoice(1, 1, "Q3 campaign: creative, media buying and reporting", 3_120_000, 0);
  await invoice(0, 0, "Monthly social media & content retainer", 1_250_000, 0);
  await db.business.update({ where: { id: b.id }, data: { nextInvoiceNo: n } });

  // Team: four staff and one contractor.
  const team = await Promise.all([
    ["Chidi Okonkwo", "Creative Director", 950_000, "EMPLOYEE", 2_400_000],
    ["Amaka Obi", "Account Manager", 480_000, "EMPLOYEE", 1_500_000],
    ["Yusuf Bello", "Senior Designer", 420_000, "EMPLOYEE", 1_200_000],
    ["Blessing Udo", "Social Media Executive", 250_000, "EMPLOYEE", 0],
    ["Femi Lawal", "Freelance motion designer", 300_000, "CONTRACTOR", 0],
  ].map(([fullName, jobTitle, monthlyGross, kind, annualRent]) => db.employee.create({
    data: {
      businessId: b.id, fullName: fullName as string, jobTitle: jobTitle as string, monthlyGross: monthlyGross as number, kind: kind as string,
      annualRent: annualRent as number, pension: kind === "EMPLOYEE", whtRate: 5, bankName: "Access Bank", accountNumber: `07${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      accountName: fullName as string, email: `${(fullName as string).split(" ")[0].toLowerCase()}@northwind.test`, pfa: kind === "EMPLOYEE" ? "Stanbic IBTC Pension" : null,
    },
  })));

  // Paid pay runs for the last 6 months, with their expenses, like the real "mark as paid" does.
  for (let m = 6; m >= 1; m--) {
    const period = periodOf(monthsAgo(m, 1));
    const payDate = payDateFor(period, 25);
    const items = team.map((e) => ({ e, p: computePay(e) }));
    const sum = (k: Exclude<keyof ReturnType<typeof computePay>, "payeStatus">) => r2(items.reduce((s, x) => s + x.p[k], 0));
    const run = await db.payRun.create({
      data: {
        businessId: b.id, period, payDate, status: "PAID", paidAt: payDate,
        gross: sum("gross"), paye: sum("paye"), pensionEmployee: sum("pensionEmployee"), pensionEmployer: sum("pensionEmployer"), nhf: sum("nhf"), wht: sum("wht"), net: sum("net"),
        items: { create: items.map(({ e, p }) => ({ employeeId: e.id, fullName: e.fullName, jobTitle: e.jobTitle, kind: e.kind, bankName: e.bankName, accountNumber: e.accountNumber, accountName: e.accountName, ...withoutStatus(p), publicToken: token() })) },
      },
    });
    const staff = r2(items.filter((x) => x.e.kind !== "CONTRACTOR").reduce((s, x) => s + x.p.gross, 0));
    const contractors = r2(items.filter((x) => x.e.kind === "CONTRACTOR").reduce((s, x) => s + x.p.gross, 0));
    await db.expense.createMany({
      data: [
        { businessId: b.id, date: payDate, amount: staff, category: "Salaries & wages", vendor: "Payroll", payRunId: run.id },
        { businessId: b.id, date: payDate, amount: sum("pensionEmployer"), category: "Pension (employer)", vendor: "Payroll", payRunId: run.id },
        { businessId: b.id, date: payDate, amount: contractors, category: "Contractors & freelancers", vendor: "Payroll", payRunId: run.id },
      ],
    });
    // Last month's PAYE and pension already remitted; the month before too.
    if (m >= 2) await db.taxFiling.createMany({ data: [{ businessId: b.id, kind: "PAYE", period, amount: run.paye }, { businessId: b.id, kind: "PENSION", period, amount: r2(run.pensionEmployee + run.pensionEmployer) }, { businessId: b.id, kind: "WHT", period, amount: run.wht }] });
  }

  // Fixed costs: set up as recurring, with 12 months of history.
  const fixed = [
    { title: "Office rent (Lekki)", category: "Office rent", vendor: "Admiralty Estates", amount: 850_000, asBill: true, dueInDays: 7 },
    { title: "Adobe Creative Cloud (team)", category: "Software & subscriptions", vendor: "Adobe", amount: 185_000, asBill: false, dueInDays: 0 },
    { title: "Google Workspace", category: "Software & subscriptions", vendor: "Google", amount: 64_000, asBill: false, dueInDays: 0 },
    { title: "Fibre internet", category: "Internet & phone", vendor: "Swift Fibre", amount: 95_000, asBill: true, dueInDays: 14 },
  ];
  for (const f of fixed) {
    const rec = await db.recurringExpense.create({ data: { businessId: b.id, ...f, frequency: "MONTHLY", nextRunAt: monthsAgo(-1, 1) } });
    for (let m = 11; m >= 0; m--) {
      const date = monthsAgo(m, 1);
      const unpaid = f.asBill && m === 0;
      await db.expense.create({ data: { businessId: b.id, date, amount: f.amount, category: f.category, vendor: f.vendor, note: f.title, recurringExpenseId: rec.id, paid: !unpaid, dueDate: f.asBill ? addDays(date, f.dueInDays) : null, vatAmount: f.category === "Office rent" ? 0 : Math.round(f.amount * 0.075 / 1.075) } });
    }
  }
  // A few one-off expenses and an overdue bill.
  await db.expense.createMany({
    data: [
      { businessId: b.id, date: monthsAgo(3, 12), amount: 2_400_000, category: "Equipment & devices", vendor: "Slot Systems", note: "3 MacBook Pros" },
      { businessId: b.id, date: monthsAgo(2, 18), amount: 420_000, category: "Marketing & advertising", vendor: "Meta", note: "Agency showreel promotion" },
      { businessId: b.id, date: monthsAgo(1, 8), amount: 310_000, category: "Diesel & power", vendor: "Ardova" },
      { businessId: b.id, date: monthsAgo(1, 20), amount: 260_000, category: "Professional fees", vendor: "Okafor & Co (audit)", paid: false, dueDate: monthsAgo(0, 1) },
    ],
  });

  // VAT filed for everything except last month, so the tax calendar shows a realistic picture.
  for (let m = 12; m >= 2; m--) {
    const d = monthsAgo(m, 1);
    await db.taxFiling.create({ data: { businessId: b.id, kind: "VAT", period: periodOf(d), amount: 0 } });
  }

  // An open quote with a deposit, waiting on the client.
  await db.invoice.create({
    data: {
      businessId: b.id, customerId: clients[3].id, kind: "QUOTE", number: "QT-0001", status: "SENT", issueDate: monthsAgo(0, 2), dueDate: addDays(monthsAgo(0, 2), 30),
      subtotal: 2_800_000, vatRate: 7.5, vatAmount: 210_000, total: 3_010_000, depositPercent: 50, publicToken: token(), sentAt: monthsAgo(0, 2),
      items: { create: [{ description: "2027 brand campaign: strategy, shoot and edit", quantity: 1, unitPrice: 2_800_000, amount: 2_800_000, position: 0 }] },
    },
  });
  await db.business.update({ where: { id: b.id }, data: { nextQuoteNo: 2 } });
  console.log(`Demo ready: ${email} (Northwind Creative Ltd)`);
}

main().finally(() => db.$disconnect());
