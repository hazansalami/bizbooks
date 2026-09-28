import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BizBooks collects, uses and protects personal data under the Nigeria Data Protection Act 2023.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  const L = LEGAL;
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-brand">Legal</p>
      <h1 className="mt-2 text-4xl tracking-[-0.03em] sm:text-5xl">Privacy Policy</h1>
      <p className="mt-3 text-muted">Effective {L.effective} · Version {TERMS_VERSION}</p>

      <div className="article-body mt-10">
        <p>{L.entity}, trading as {L.product} (&ldquo;we&rdquo;), is the data controller for personal data about our account holders, website visitors and leads. For personal data you put into {L.product} about <em>your</em> clients and employees, you are the controller and we process it on your instructions. This policy follows the Nigeria Data Protection Act 2023 (NDPA).</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, email, phone, password (stored as a one-way hash) and your acceptance of our Terms.</li>
          <li><strong>Business data you enter:</strong> company details, clients, invoices, expenses, employee and payroll details (such as salaries, bank details and pension PINs) and receipts.</li>
          <li><strong>Payment gateway keys</strong> you connect, which are encrypted before storage.</li>
          <li><strong>Calculator and advisory requests:</strong> the email address and inputs you submit when you ask us to email results or book a consultation.</li>
          <li><strong>Technical data:</strong> basic logs (such as IP address, device and pages used) needed to run and secure the Services.</li>
        </ul>

        <h2>Why we use it (lawful bases)</h2>
        <ul>
          <li>To provide the Services you signed up for (<strong>contract</strong>).</li>
          <li>To send service emails: invoices you send, reminders, receipts, security and billing notices (<strong>contract</strong> and <strong>legitimate interests</strong>).</li>
          <li>To send you results and related guides you request, and occasional product updates you can opt out of at any time (<strong>consent</strong> and <strong>legitimate interests</strong>).</li>
          <li>To keep the Services secure, prevent fraud and comply with the law (<strong>legal obligation</strong> and <strong>legitimate interests</strong>).</li>
        </ul>
        <p>We do not sell personal data.</p>

        <h2>Who we share it with</h2>
        <p>Only service providers that help us run {L.product}, under contract: hosting and database providers, email delivery providers, and the payment gateways you connect. We may disclose data where the law requires it. Some providers store data outside Nigeria. Where they do, we rely on the transfer safeguards the NDPA allows.</p>

        <h2>How long we keep it</h2>
        <p>Account and business data are kept while your account is active and for a reasonable period afterwards to meet legal and tax record-keeping requirements, then deleted or anonymised. Leads who don&rsquo;t become customers are deleted within 24 months of their last interaction.</p>

        <h2>Your rights</h2>
        <p>You can ask to access, correct, delete or port your personal data, object to or restrict processing, and withdraw consent at any time. Email <a href={`mailto:${L.privacyEmail}`}>{L.privacyEmail}</a>. If you&rsquo;re not satisfied, you can complain to the Nigeria Data Protection Commission.</p>

        <h2>Security</h2>
        <p>We use encryption in transit, encrypted storage of gateway secret keys, hashed passwords and access controls. No system is completely secure, so please use a strong, unique password and keep it private.</p>

        <h2>Changes</h2>
        <p>We&rsquo;ll post updates here and tell account holders about material changes. See also our <Link href="/terms">Terms of Service</Link>.</p>

        <h2>Contact</h2>
        <p>{L.entity}, {L.address}. Email: <a href={`mailto:${L.privacyEmail}`}>{L.privacyEmail}</a>.</p>
      </div>
    </article>
  );
}
