import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of BizBooks, its website, calculators, guides and advisory services.",
  alternates: { canonical: "/terms" },
};

const S = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <h2>{title}</h2>
    {children}
  </section>
);

export default function Terms() {
  const L = LEGAL;
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-brand">Legal</p>
      <h1 className="mt-2 text-4xl tracking-[-0.03em] sm:text-5xl">Terms of Service</h1>
      <p className="mt-3 text-muted">Effective {L.effective} · Version {TERMS_VERSION}</p>

      <div className="mt-6 rounded-2xl border border-sun/50 bg-sun-wash p-5 text-sun-ink">
        <p className="font-semibold">The short version</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
          <li>{L.product} is software and general information. It is <strong>not</strong> tax, legal, accounting or financial advice.</li>
          <li>You are responsible for your own records, filings, tax payments, payroll and compliance, and for checking every figure before you rely on it.</li>
          <li>We never hold, receive or move your money. Payments go through your own bank, Paystack or Flutterwave account.</li>
          <li>To the fullest extent the law allows, we are not liable for losses, penalties, interest or fines arising from your use of {L.product} or anything on our website.</li>
        </ul>
      </div>

      <div className="article-body mt-10">
        <S id="agreement" title="1. Agreement">
          <p>These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you and {L.entity} ({L.rcNumber}), trading as {L.product} (&ldquo;{L.product}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They govern your use of the {L.product} application, website, calculators, articles, templates, emails and advisory services (together, the &ldquo;Services&rdquo;).</p>
          <p>By creating an account, ticking the box at sign-up, or using any part of the Services, you confirm that you have read, understood and agree to these Terms and our <Link href="/privacy">Privacy Policy</Link>. If you use the Services on behalf of a company, you confirm you are authorised to bind that company, and &ldquo;you&rdquo; includes it. If you do not agree, do not use the Services.</p>
        </S>

        <S id="no-advice" title="2. Information only: no professional advice">
          <p>Everything in the Services, including tax, VAT, withholding tax, PAYE, pension and payroll calculations, the tax calendar, deadlines, reports, articles, guides, glossaries, calculators, templates, emails and in-app guidance (&ldquo;Information&rdquo;), is provided <strong>for general information only</strong>. It is <strong>not</strong> tax, legal, accounting, audit, investment, financial or other professional advice, and no advisor–client relationship is created by it.</p>
          <p>Nigerian tax law and its interpretation change often, sources sometimes conflict, and the Information may be <strong>incomplete, out of date, simplified or wrong</strong>. Figures are estimates based on the data you enter and our interpretation of published rules at a point in time. They may not reflect your circumstances, exemptions, reliefs, elections, state practices or rulings of the tax authorities.</p>
          <p><strong>You must not rely on the Information as a substitute for advice from a qualified professional</strong> (such as a chartered accountant, chartered tax adviser or lawyer) before making any decision, filing any return, paying or remitting any tax, running payroll or taking any other action.</p>
        </S>

        <S id="your-responsibility" title="3. Your responsibilities">
          <p>You are solely responsible for:</p>
          <ul>
            <li>the accuracy and completeness of all data you or your team enter, import or approve;</li>
            <li>checking every calculation, invoice, payslip, report, deadline and amount before relying on, sending, filing or paying it;</li>
            <li>registering with, filing returns with and paying or remitting all taxes, levies and contributions to the relevant authorities (including the Nigeria Revenue Service, State Internal Revenue Services, pension fund administrators, NSITF, ITF and others) correctly and on time;</li>
            <li>your employment, payroll, data protection, consumer and other legal obligations;</li>
            <li>the content of invoices, quotes, emails and messages you send to your clients or staff through the Services; and</li>
            <li>keeping your login details secure and all activity under your account.</li>
          </ul>
          <p>Reminders, deadlines and alerts are conveniences. They may fail, be delayed or be incorrect. Their absence does not relieve you of any obligation.</p>
        </S>

        <S id="payments" title="4. Payments and third-party services">
          <p>{L.product} is not a bank, payment service provider, switch, wallet or money transmitter. <strong>We never hold, pool or transfer your or your clients&rsquo; funds.</strong> Online payments are processed and settled by licensed payment providers (such as Paystack or Flutterwave). Salaries and other payments are made from your own bank account.</p>
          <p><strong>Your own gateway.</strong> If you connect your own Paystack or Flutterwave account, payments are processed under your own agreement with that provider, using credentials you provide, and land in your own gateway account.</p>
          <p><strong>{L.product} Payments.</strong> If you turn on {L.product} Payments, your clients pay through a checkout provided by Paystack on {L.product}&rsquo;s Paystack account, and Paystack settles your share directly to the business bank account you nominate, on Paystack&rsquo;s settlement schedule. By turning it on you agree that:</p>
          <ul>
            <li>it is available only to registered businesses, and the settlement account must belong to the business. We verify account names with your bank through Paystack, may ask for further documents, and may share your business details with Paystack for verification and anti-money-laundering checks;</li>
            <li>a flat processing fee (currently &#8358;500 per successful payment, VAT inclusive, with no fee on payments under &#8358;2,500) and Paystack&rsquo;s standard fees are deducted before settlement. Fees are shown before you turn the service on and may change with notice. Fee-free allowances and rewards have no cash value;</li>
            <li>you are responsible for the goods and services you invoice for, and for refunds, disputes and chargebacks raised by your clients. Where Paystack reverses or charges back a payment, the amount and any related fees may be recovered from future settlements to you or otherwise from you;</li>
            <li>we may pause or end {L.product} Payments for your business, or hold a change of settlement account for review, to prevent fraud, meet Paystack&rsquo;s or legal requirements, or where these Terms are breached. Clients can still pay you by bank transfer; and</li>
            <li>Paystack&rsquo;s own terms and acceptable use policy also apply to payments made through the service.</li>
          </ul>
          <p>We are not responsible for the acts, omissions, fees, availability, security, settlements, reversals, chargebacks or failures of any bank, payment provider, email provider, hosting provider or other third party, or for any loss caused by them. You are responsible for keeping your gateway keys and account access secure, for your settlement details being correct, and for the transactions made with them.</p>
        </S>

        <S id="advisors" title="5. Advisory services">
          <p>Done-for-you services offered by the {L.product} advisory team (such as bookkeeping, tax filing support or payroll management) are provided only under a separate written engagement letter. Until an engagement letter is signed, any consultation, call or message is general information under section 2. Where an engagement letter conflicts with these Terms, the engagement letter governs those services only.</p>
        </S>

        <S id="plans" title="6. Plans, fees and cancellation">
          <p>Some features require a paid plan. Prices are shown before you pay and may change with notice for future periods. We do not charge you automatically; you choose when to pay or renew. Fees already paid are non-refundable except where required by law. You may stop using the Services at any time; paid features continue until the end of the paid period.</p>
        </S>

        <S id="use" title="7. Acceptable use">
          <p>You must not use the Services to break any law; to send fraudulent, misleading or unsolicited invoices or messages; to evade tax; to infringe anyone&rsquo;s rights; to upload malware; to access data that isn&rsquo;t yours; or to interfere with, copy or reverse engineer the Services. We may suspend or close accounts that do.</p>
        </S>

        <S id="data" title="8. Your data">
          <p>You own the business data you put into {L.product}. You give us permission to host, process and back it up to provide and improve the Services, as described in our <Link href="/privacy">Privacy Policy</Link>. You are responsible for having a lawful basis to share your clients&rsquo; and employees&rsquo; personal data with us. You can export your data while your account is active. We are not responsible for keeping your records for statutory retention periods: keep your own copies.</p>
        </S>

        <S id="ip" title="9. Intellectual property">
          <p>The Services, including software, design, text, articles, calculators and trademarks, belong to us or our licensors. You may share links to our articles and calculators and quote short extracts with attribution. You may not copy, resell or republish the Services or substantial parts of our content without written permission.</p>
        </S>

        <S id="warranty" title="10. No warranties">
          <p>To the fullest extent permitted by law, the Services and all Information are provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>, without warranties of any kind, express or implied, including warranties of accuracy, completeness, timeliness, fitness for a particular purpose, non-infringement, or that the Services will be uninterrupted, secure or error-free, or that any calculation, deadline or report is correct or complies with any law.</p>
        </S>

        <S id="liability" title="11. Limitation of liability">
          <p>To the fullest extent permitted by applicable law:</p>
          <ul>
            <li>{L.product} and its directors, employees, advisers, agents and partners will <strong>not be liable</strong> for any indirect, incidental, special, consequential, exemplary or punitive loss or damage, or for any loss of profit, revenue, business, goodwill, data or opportunity, however caused;</li>
            <li>we will <strong>not be liable for any tax, penalty, interest, surcharge, fine, levy, assessment or audit cost</strong>, or any employee, client, regulatory or third-party claim, arising from or related to your use of, or reliance on, the Services or any Information, including calculations, deadlines, reminders, articles and calculators;</li>
            <li>we will not be liable for losses caused by your data, your decisions, third-party services, events beyond our reasonable control, or your failure to follow these Terms; and</li>
            <li>our <strong>total aggregate liability</strong> for all claims relating to the Services in any 12-month period will not exceed the greater of (a) the fees you paid us for the Services in the 12 months before the event giving rise to the claim, and (b) ₦50,000.</li>
          </ul>
          <p>Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for fraud, or rights you have as a consumer under the Federal Competition and Consumer Protection Act 2018 that cannot be waived. In that case our liability is limited to the minimum extent the law permits.</p>
        </S>

        <S id="indemnity" title="12. Indemnity">
          <p>You agree to indemnify and hold harmless {L.product} and its directors, employees and agents against all claims, losses, liabilities, penalties, costs and expenses (including reasonable legal fees) arising from your use of the Services, your data, your filings and payments, your dealings with your clients, employees and tax authorities, or your breach of these Terms or any law.</p>
        </S>

        <S id="changes" title="13. Changes, suspension and termination">
          <p>We may change, suspend or discontinue any part of the Services, and may update these Terms. Material changes will be notified in the app or by email and take effect from the date stated. Continuing to use the Services after that date means you accept the updated Terms. We may suspend or terminate access for breach of these Terms, non-payment, legal requirements or risk to the Services or other users.</p>
        </S>

        <S id="law" title="14. Governing law and disputes">
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria. The parties will first try to resolve any dispute in good faith within 30 days of written notice. Unresolved disputes will be finally resolved by arbitration under the Arbitration and Mediation Act 2023, seated in {L.seat}, before a sole arbitrator, in English. Either party may seek urgent injunctive relief from a competent court.</p>
        </S>

        <S id="general" title="15. General">
          <p>If any provision is found unenforceable, it will be limited to the minimum extent necessary and the rest remains in force. Failure to enforce a right is not a waiver. You may not assign these Terms without our consent. These Terms, the Privacy Policy and any engagement letter are the entire agreement about the Services.</p>
        </S>

        <S id="contact" title="16. Contact">
          <p>{L.entity}, {L.address}. Email: <a href={`mailto:${L.email}`}>{L.email}</a>.</p>
        </S>
      </div>
    </article>
  );
}
