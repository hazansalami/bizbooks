---
title: How to move your books from Wave or Zoho Books (without losing history)
description: Which reports to export from Wave and Zoho Books, what each one contains, and how to bring clients, invoices, services, payments and retainers into a new accounting tool without losing anything important.
category: running
summary: To switch accounting software without losing history, export your full invoice history with line items and balances, your client list, and your recurring invoices. From Zoho Books, the Invoices export has everything. From Wave, the Account Transactions report (all time, accrual) has clients, invoice numbers, services and VAT but not due dates or descriptions, so add your customer list and check which invoices are unpaid.
keywords: export data from wave, wave to zoho books, zoho books export invoices, migrate accounting software nigeria, switch from wave, import invoices csv
published: 2026-09-28
updated: 2026-09-28
---

Switching accounting software is easy to put off, because the history feels like it's locked in. It isn't. Both Wave and Zoho Books export CSV files that another tool can read. The trick is exporting the right ones.

## What do I need to bring across?

Five things matter. Everything else can start fresh:

| What | Why it matters |
|---|---|
| **Clients** with emails, phones, addresses and Tax IDs | So new invoices go to the right people, and corporate clients' TINs stay on file |
| **Invoices** with numbers, dates, line items and VAT | Your sales history, VAT records and income-by-client reports |
| **Which invoices are unpaid** | So you keep collecting what you're owed |
| **Services** with their usual prices and descriptions | So new invoices take seconds |
| **Retainers** (recurring invoices) | So next month's invoices go out without a gap |

## Which export is best from Zoho Books?

Zoho Books' exports are complete. In Zoho Books:

1. **Sales → Invoices → ⋯ → Export Invoices.** Choose all invoices, CSV, and include all fields. You get one row per line item, with the item name and description, quantity, rate, tax, due date, status and balance, so paid and unpaid invoices come across exactly.
2. **Sales → Customers → ⋯ → Export Customers** for contact details and Tax IDs.
3. **Sales → Recurring Invoices → ⋯ → Export** for your retainers, with their frequency and next invoice date.

## Which export is best from Wave?

Wave gives you less detail, so it helps to know what each file contains:

| Wave export | Has | Doesn't have |
|---|---|---|
| **Reports → Account Transactions** (all time, accrual, CSV) | Client, invoice number, date, each service, amounts, VAT, and payments you recorded against invoices | Due dates, quantities and rates, line descriptions, client emails |
| **Settings → Data Export** (Accounting and Sales) | Your full accounting transactions and sales records | Varies by export; upload them all and check what's recognised |
| **Customer list** export | Client names, emails, phones, addresses | Invoices |

**Tips for the Account Transactions report:**

- Set the date range to **All time**, or at least from your first unpaid invoice. If the report starts mid-year, older unpaid invoices won't be in it and the report will show an opening receivables balance instead.
- Use **Accrual (Paid & Unpaid)**. A cash-basis report leaves out unpaid invoices.
- Include **Accounts Receivable**, your **sales/income** accounts and **VAT**. Receivables gives each invoice's total, sales gives the services, and VAT gives the tax.
- If you never recorded payments in Wave, the report can't tell paid from unpaid. Decide which invoices are still owed before you import.

## What gets lost, and how do I fix it?

- **Long item descriptions** (scope, deliverables) aren't in Wave's reports. Re-add them to your saved services once, and every future invoice gets them.
- **Due dates** from Wave: your new tool will use your payment terms. Adjust the few unpaid invoices that had different terms.
- **Attachments and receipts** usually need a separate download. Wave's Receipts export is a ZIP file.
- **Invoice design**: choose a similar style in your new tool so clients recognise it.

## How do I avoid double-counting?

- **Import once, then check totals.** Your invoiced total for the period should match the old tool's sales, and your unpaid total should match its aged receivables.
- **Pick a switch-over date**, such as the first of next month. Create new invoices only in the new tool from that date.
- **Keep numbering continuous.** If your last Wave invoice was 0331, the next one should be 0332, not 0001.
- **Stop old recurring invoices** in Wave or Zoho Books once they're running in the new tool, so clients don't get two.

## Moving to BizBooks

BizBooks reads these files directly. Open **Settings → Import**, drop in every CSV, and you'll see:

- each invoice rebuilt with client, number, date, services, VAT and status
- clients from your customer list matched to the right invoices
- retainers spotted from your history (same client, same amount, every month), ready to set up as recurring invoices
- a check for invoices already in BizBooks, so importing twice is safe

Nothing is saved until you confirm, and imported invoices never email your clients. Your numbering carries on where it stopped. [BizBooks vs Wave](/compare/wave) · [BizBooks vs Zoho Books](/compare/zoho-books).

## Frequently asked questions

### Can I export invoices from Wave?

Yes. Use Reports → Account Transactions (all time, accrual) and export CSV, or Settings → Data Export. The Account Transactions report has each invoice's client, number, date, services and VAT, but not due dates or line descriptions.

### How do I export all invoices from Zoho Books?

Go to Sales → Invoices, open the ⋯ menu, choose Export Invoices, select all invoices and CSV. The file has one row per line item, including descriptions, tax, due dates and balances.

### Will my recurring invoices move across?

From Zoho Books, export Recurring Invoices and import them. Wave doesn't export recurring invoices, but a tool that reads your history can spot them: the same client billed the same amount every month.

### Should I import paid invoices or only unpaid ones?

Import everything if you can. Paid invoices give you income-by-client reports and a full VAT history. If time is short, start with unpaid invoices so you can keep collecting.
