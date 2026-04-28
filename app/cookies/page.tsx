import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Cookie Statement — TrailBill" };

export default function CookiesPage() {
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
          <h1 className="text-3xl font-bold mb-3">Cookie Statement</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This Cookie Statement explains how TrailBill uses cookies and similar technologies when you
            visit our website or use our Platform.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-3">1. What Are Cookies?</h2>
            <p className="text-muted-foreground">
              Cookies are small text files placed on your device by a website or application. They are widely
              used to make websites work efficiently, remember your preferences, and provide information to
              website operators. Cookies cannot harm your device or access other files on it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. Cookies We Use</h2>
            <p className="text-muted-foreground mb-4">TrailBill uses only the cookies necessary to operate the Platform:</p>

            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary flex-shrink-0 mt-0.5">Essential</span>
                  <div>
                    <p className="font-medium text-foreground mb-1">Authentication Session Cookie</p>
                    <p className="text-muted-foreground text-xs mb-1">
                      <strong>Provider:</strong> Supabase &nbsp;|&nbsp; <strong>Duration:</strong> Session / up to 7 days
                    </p>
                    <p className="text-muted-foreground">
                      Stores your login session so you remain authenticated while using the Platform. Without
                      this cookie, you would need to log in on every page. This cookie is strictly necessary
                      for the Platform to function.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary flex-shrink-0 mt-0.5">Essential</span>
                  <div>
                    <p className="font-medium text-foreground mb-1">CSRF Protection Token</p>
                    <p className="text-muted-foreground text-xs mb-1">
                      <strong>Provider:</strong> Next.js &nbsp;|&nbsp; <strong>Duration:</strong> Session
                    </p>
                    <p className="text-muted-foreground">
                      Protects form submissions from cross-site request forgery attacks. This is a security
                      cookie required for safe operation of the Platform.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary flex-shrink-0 mt-0.5">Essential</span>
                  <div>
                    <p className="font-medium text-foreground mb-1">Theme / Preference Cookie</p>
                    <p className="text-muted-foreground text-xs mb-1">
                      <strong>Provider:</strong> TrailBill &nbsp;|&nbsp; <strong>Duration:</strong> 1 year
                    </p>
                    <p className="text-muted-foreground">
                      Remembers your display preferences (e.g. dark or light mode) so your settings are
                      maintained across visits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. What We Do Not Use</h2>
            <p className="text-muted-foreground mb-2">TrailBill does <strong className="text-foreground">not</strong> use:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Advertising or tracking cookies</li>
              <li>Third-party analytics cookies (e.g. Google Analytics)</li>
              <li>Social media tracking pixels</li>
              <li>Behavioural profiling cookies</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Our cookies are strictly limited to what is necessary to operate and secure the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Managing Cookies</h2>
            <p className="text-muted-foreground mb-2">
              You can control and delete cookies through your browser settings. Most browsers allow you to:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 mb-2">
              <li>View cookies currently stored on your device</li>
              <li>Delete individual or all cookies</li>
              <li>Block cookies from specific websites</li>
              <li>Block all third-party cookies</li>
            </ul>
            <p className="text-muted-foreground">
              Please note that blocking or deleting our essential cookies will prevent you from logging in
              and using the Platform. Since we only use necessary cookies, there is no option to opt out of
              cookies while continuing to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Browser-Specific Cookie Settings</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-za/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Apple Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Changes to This Statement</h2>
            <p className="text-muted-foreground">
              We may update this Cookie Statement if we introduce new features that require additional cookies.
              We will update the date at the top of this page and, where appropriate, notify users by email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Contact</h2>
            <p className="text-muted-foreground">
              Questions about our cookie practices? Contact us at{" "}
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
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="text-primary font-medium">Cookie Statement</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
