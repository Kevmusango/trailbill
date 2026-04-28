import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Terms and Conditions — TrailBill" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
          </Link>
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Log In
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-xs text-muted-foreground mb-2">Last updated: 15 April 2025</p>
          <h1 className="text-3xl font-bold mb-3">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please read these Terms and Conditions carefully before using TrailBill. By accessing or using
            our platform, you agree to be bound by these terms.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-3">1. Definitions</h2>
            <p className="text-muted-foreground">
              &ldquo;TrailBill&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo; refers to TrailBill (Pty) Ltd, a company incorporated
              in South Africa. &ldquo;Platform&rdquo; means the TrailBill web application at app.trailbill.com.
              &ldquo;Business&rdquo; or &ldquo;you&rdquo; means the entity registered to use the Platform. &ldquo;Client&rdquo; means any
              third party to whom a Business sends payment requests. &ldquo;Subscription&rdquo; means the paid access
              plan selected by the Business.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. Access and Account</h2>
            <p className="text-muted-foreground mb-2">
              Access to TrailBill is by invitation only — there is no public self-registration. Accounts are
              created by TrailBill administrators upon approval of an interest application.
            </p>
            <p className="text-muted-foreground mb-2">
              You are responsible for keeping your login credentials confidential. Notify us immediately at{" "}
              <a href="mailto:support@trailbill.com" className="text-primary hover:underline">support@trailbill.com</a>{" "}
              if you suspect unauthorised access.
            </p>
            <p className="text-muted-foreground">
              Each account is for a single Business entity. Sharing accounts across multiple unrelated businesses is not permitted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Subscription and Payment</h2>
            <p className="text-muted-foreground mb-2">Subscriptions are billed monthly in South African Rand (ZAR). Current plans:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 mb-2">
              <li><strong className="text-foreground">Starter</strong> — R299/month (up to 50 clients, 3 groups)</li>
              <li><strong className="text-foreground">Pro</strong> — R599/month (unlimited clients and groups)</li>
            </ul>
            <p className="text-muted-foreground mb-2">
              Payment arrangements are confirmed between you and TrailBill separately. Non-payment may result
              in suspension or deactivation of your account.
            </p>
            <p className="text-muted-foreground">
              We reserve the right to update pricing with 30 days&apos; written notice. Continued use after the
              notice period constitutes acceptance of the new pricing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Permitted Use</h2>
            <p className="text-muted-foreground mb-2">You may use TrailBill solely for lawful business purposes, including sending payment
              requests, tracking balances, and generating reports. You may not use the Platform to:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Send spam, harassment, or unsolicited communications</li>
              <li>Process payments for illegal goods or services</li>
              <li>Misrepresent your identity or business</li>
              <li>Reverse-engineer, scrape, or exploit the Platform</li>
              <li>Upload malicious code or compromise system security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Your Data and Client Data</h2>
            <p className="text-muted-foreground mb-2">
              You retain ownership of all data you upload. By using TrailBill, you grant us a limited licence
              to process your data solely to provide the Platform services.
            </p>
            <p className="text-muted-foreground mb-2">
              You are responsible for ensuring you have lawful grounds to share your clients&apos; personal
              information with us in compliance with POPIA (Act 4 of 2013).
            </p>
            <p className="text-muted-foreground">
              Client personal data is automatically removed after 12 months of inactivity. Financial records
              are retained for 5 years as required by SARS. See our{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for full details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Service Availability</h2>
            <p className="text-muted-foreground">
              We aim for high availability but do not guarantee uninterrupted access. We are not liable for
              downtime caused by third-party services or circumstances beyond our control. Automated email
              delivery depends on third-party providers and cannot be guaranteed for all recipients.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-2">
              TrailBill is a payment tracking and communication tool. We do not process payments, hold funds,
              or guarantee that your clients will pay. Payment disputes are strictly between you and your clients.
            </p>
            <p className="text-muted-foreground">
              Our total liability for any claim shall not exceed subscription fees paid in the 3 months
              preceding the claim. We are not liable for indirect or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Termination</h2>
            <p className="text-muted-foreground mb-2">
              Request cancellation at any time by emailing{" "}
              <a href="mailto:support@trailbill.com" className="text-primary hover:underline">support@trailbill.com</a>.
              Cancellation takes effect at the end of the current billing period. No refunds for partial months.
            </p>
            <p className="text-muted-foreground">
              We may terminate your account immediately for material breach, non-payment, or unlawful use.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">9. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All intellectual property in the Platform belongs to TrailBill (Pty) Ltd. Nothing in these
              terms grants rights in our intellectual property beyond the limited right to use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">10. Governing Law</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of the Republic of South Africa and subject to the
              exclusive jurisdiction of South African courts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">11. Changes to These Terms</h2>
            <p className="text-muted-foreground">
              We will notify registered businesses by email at least 14 days before material changes take effect.
              Continued use constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">12. Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms?{" "}
              <a href="mailto:support@trailbill.com" className="text-primary hover:underline">support@trailbill.com</a>
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border py-8 px-4 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="text-sm text-muted-foreground">TrailBill &copy; {new Date().getFullYear()}</span>
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm">
            <Link href="/terms" className="text-primary font-medium">Terms</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookie Statement</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
