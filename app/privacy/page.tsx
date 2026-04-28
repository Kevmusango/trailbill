import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Privacy Policy — TrailBill" };

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            TrailBill (Pty) Ltd is committed to protecting your personal information in accordance with the
            Protection of Personal Information Act 4 of 2013 (POPIA) and all applicable South African privacy legislation.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-3">1. Information Officer</h2>
            <p className="text-muted-foreground">
              Our Information Officer is responsible for ensuring compliance with POPIA. You may contact them at:{" "}
              <a href="mailto:support@trailbill.com" className="text-primary hover:underline">support@trailbill.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. What Personal Information We Collect</h2>
            <p className="text-muted-foreground mb-2">We collect the following categories of personal information:</p>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground mb-1">Business account holders:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Full name, email address, and phone number</li>
                  <li>Business name, province, city, and industry</li>
                  <li>Banking details (for display on client payment pages only)</li>
                  <li>Login credentials (password stored as a secure hash)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Clients of TrailBill businesses:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Name, email address, and phone number</li>
                  <li>Payment history and outstanding balances</li>
                  <li>Payment behaviour patterns and reliability scores</li>
                  <li>IP address and timestamp when a payment link is accessed</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. How We Collect Personal Information</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Directly from business account holders when registering or updating their profile</li>
              <li>From businesses when they add client records to their account</li>
              <li>Automatically when clients access payment links (access time, device type)</li>
              <li>Through use of the Platform (activity logs, payment events)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Why We Process Personal Information</h2>
            <p className="text-muted-foreground mb-2">We process personal information for the following lawful purposes:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>To provide, operate, and improve the TrailBill Platform</li>
              <li>To send automated payment reminders and follow-up emails to clients on behalf of businesses</li>
              <li>To generate automated reports for business account holders</li>
              <li>To calculate payment behaviour patterns and reliability scores</li>
              <li>To comply with legal obligations (e.g. SARS financial record retention)</li>
              <li>To respond to support queries and account management requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Sharing of Personal Information</h2>
            <p className="text-muted-foreground mb-2">
              We do not sell, rent, or trade personal information. We share data only where necessary:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong className="text-foreground">Supabase</strong> — our database and authentication provider (data stored in EU-West region)</li>
              <li><strong className="text-foreground">Resend</strong> — our transactional email provider, used to send reminders and reports</li>
              <li><strong className="text-foreground">Vercel</strong> — our hosting platform</li>
              <li>Law enforcement or regulatory authorities where required by law</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              All third-party providers are bound by appropriate data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Data Retention</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Client personal information (name, email, phone) is automatically anonymised after <strong className="text-foreground">12 months of inactivity</strong></li>
              <li>Financial records (payment amounts, dates, balances) are retained for <strong className="text-foreground">5 years</strong> as required by SARS</li>
              <li>Business account data is retained for the duration of the subscription and deleted upon written request after cancellation</li>
              <li>System logs are retained for up to 90 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures including encrypted data transmission (TLS),
              password hashing, role-based access control, and row-level security on our database. Access to
              production data is restricted to authorised personnel only. Despite these measures, no system
              is completely secure and we cannot guarantee absolute data security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Your Rights Under POPIA</h2>
            <p className="text-muted-foreground mb-2">As a data subject, you have the right to:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong className="text-foreground">Access</strong> — request a copy of personal information we hold about you</li>
              <li><strong className="text-foreground">Correction</strong> — request correction of inaccurate or incomplete information</li>
              <li><strong className="text-foreground">Deletion</strong> — request erasure of your personal information (subject to legal retention obligations)</li>
              <li><strong className="text-foreground">Objection</strong> — object to the processing of your personal information</li>
              <li><strong className="text-foreground">Complaint</strong> — lodge a complaint with the Information Regulator of South Africa</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@trailbill.com" className="text-primary hover:underline">support@trailbill.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">9. Information Regulator</h2>
            <p className="text-muted-foreground">
              If you are unsatisfied with how we handle your personal information, you may contact the
              Information Regulator of South Africa at{" "}
              <a href="mailto:inforeg@justice.gov.za" className="text-primary hover:underline">inforeg@justice.gov.za</a>{" "}
              or visit{" "}
              <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                inforegulator.org.za
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">10. Cookies</h2>
            <p className="text-muted-foreground">
              We use cookies to operate the Platform. See our{" "}
              <Link href="/cookies" className="text-primary hover:underline">Cookie Statement</Link> for full details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy periodically. We will notify users by email of material
              changes. Continued use of the Platform after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy-related queries, contact our Information Officer at{" "}
              <a href="mailto:support@trailbill.com" className="text-primary hover:underline">support@trailbill.com</a>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border py-8 px-4 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="text-sm text-muted-foreground">TrailBill &copy; {new Date().getFullYear()}</span>
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="text-primary font-medium">Privacy Policy</Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookie Statement</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
