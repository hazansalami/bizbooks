import { notFound, redirect } from "next/navigation";
import { completeTestCheckout, testCheckoutDetails, testMode } from "@/lib/platform-payments";
import { naira } from "@/lib/money";

export const metadata = { title: "Test checkout", robots: { index: false } };

/** Development only: stands in for Paystack's hosted checkout when there's no platform key. */
export default async function TestCheckout({ searchParams }: { searchParams: Promise<{ reference?: string; next?: string }> }) {
  if (!testMode()) notFound();
  const { reference = "", next = "/" } = await searchParams;
  const tx = testCheckoutDetails(reference);
  if (!tx) notFound();

  async function pay() {
    "use server";
    if (!testMode()) notFound();
    completeTestCheckout(reference);
    const back = new URL(next, "http://x");
    back.searchParams.set("reference", reference);
    redirect(back.pathname + back.search);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border-2 border-dashed border-sun bg-paper p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-sun-ink">Test mode · no real money</p>
        <h1 className="mt-2 text-2xl">Simulated Paystack checkout</h1>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="num font-bold">{naira(tx.amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Payer</dt><dd>{tx.email}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Settles to subaccount</dt><dd className="num">{tx.subaccount}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">BizBooks fee</dt><dd className="num">{naira(tx.fee)}</dd></div>
        </dl>
        <form action={pay} className="mt-6">
          <button className="min-h-12 w-full rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-deep">Simulate successful payment</button>
        </form>
      </div>
    </main>
  );
}
