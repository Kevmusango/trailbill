import Link from "next/link";
import { CheckCircle2, ArrowRight, Mail, MessageCircle, Smartphone, ClipboardList } from "lucide-react";

const steps = [
  { step: "1", title: "Set your terms", description: "Add your clients, set your due date window and your late fee rules. You stay in control." },
  { step: "2", title: "Client receives a commitment request", description: "They get a professional link — by Email, WhatsApp or SMS — and choose a payment date inside your terms." },
  { step: "3", title: "They own it from here", description: "Because they chose the date, follow-through is on them. TrailBill handles every automatic reminder. You do nothing." },
];


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="" className="h-8 w-auto object-contain" />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Log In
            </Link>
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Get Early Access
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-10 md:py-14 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-background pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="hidden sm:inline-flex items-center gap-2 bg-primary/10 text-primary text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full mb-4 border border-primary/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Commitment first. Follow-through built in.
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-[1.1]">
            Clients pay better when
            <br />
            <span className="text-primary">they commit first.</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-xl mx-auto leading-relaxed">
            TrailBill turns vague payment promises into chosen dates — with automatic follow-through built in. So you stop chasing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors gap-2 shadow-lg shadow-primary/25"
            >
              Stop Chasing Clients
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-12 px-8 rounded-lg border border-input bg-background/80 font-medium text-base hover:bg-muted transition-colors"
            >
              Log In
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Proposals &amp; commitment requests</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />WhatsApp, email &amp; SMS</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />No credit card required</span>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 bg-muted/30 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center">Why clients actually pay late</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
            Most clients are not bad people. They delay because nothing was ever clearly committed.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">Before the work starts</p>
              <div className="space-y-3">
                {[
                  "You send a quote and wait. No response. You follow up. Now you feel like you\'re begging.",
                  "You get a WhatsApp yes and start working — but a chat reply is not a commitment, and you both know it.",
                  "You waste time on people who were never serious, because there was no moment that filtered them out.",
                ].map((p, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">{i + 1}</div>
                    <p>{p}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-destructive mb-3">When payment is due</p>
              <div className="space-y-3">
                {[
                  "There was no chosen date — only a vague promise. So they forget. Every single month.",
                  "You become the one who has to bring it up. Same clients. Same silence. Same discomfort.",
                  "Following up feels personal. You don\'t want to damage the relationship. So you wait. And lose.",
                ].map((p, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">{i + 1}</div>
                    <p>{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insight */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-5">Client Commitment System</p>
          <h2 className="text-2xl md:text-4xl font-bold mb-5 leading-tight">
            Turn client promises
            <br className="hidden md:block" /> into commitments.
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-14">
            You set the terms. Your client chooses a payment date inside them. That choice becomes a commitment — not a reminder. Everything after runs automatically.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="rounded-xl border border-border bg-muted/30 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">The old way</p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Someone owes you money.</p>
                <p>You know it. They know it.</p>
                <p>But it&apos;s on your business to bring it up — whether that&apos;s you personally or someone on your team.</p>
                <p>And every time that happens, something quietly shifts in the relationship.</p>
              </div>
            </div>
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">With TrailBill</p>
              <div className="space-y-3 text-sm">
                <p className="font-semibold">You set the terms once.</p>
                <p className="text-muted-foreground">Your client picks a payment date inside them.</p>
                <p className="text-muted-foreground">Now it&apos;s their word — not your chase.</p>
                <p className="font-semibold">No one on your side has to make that call.</p>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">The result</p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>That monthly discomfort disappears — for you and your team.</p>
                <p>Your client feels respected. They chose the date. It was never forced.</p>
                <p>Payments arrive because of a commitment they made — not a message you sent.</p>
                <p>Your business runs like a system. Not a chase.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 bg-muted/30 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center">Built for your type of business</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Whether you quote first or invoice monthly — TrailBill creates commitment at the right moment for your workflow.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                label: "Proposals first",
                color: "text-amber-600",
                bg: "bg-amber-50 dark:bg-amber-950/20",
                border: "border-amber-200 dark:border-amber-800",
                icon: "📋",
                who: "Freelancers, agencies, project-based work",
                outcome: "Client confirms the service, price, and start window by link — not a chat message. Serious clients respond. Everyone else self-selects out. You start work knowing they\'re committed.",
              },
              {
                label: "Commitment requests",
                color: "text-primary",
                bg: "bg-primary/5",
                border: "border-primary/20",
                icon: "💳",
                who: "Tutors, cleaners, trainers, monthly retainers",
                outcome: "Client picks the day they\'ll pay inside your window. That chosen date creates ownership. Follow-through runs on their word — not a demand from you.",
              },
              {
                label: "Proposals + Commitments",
                color: "text-emerald-600",
                bg: "bg-emerald-50 dark:bg-emerald-950/20",
                border: "border-emerald-200 dark:border-emerald-800",
                icon: "🔁",
                who: "Full client journey — quote to cash",
                outcome: "Proposal accepted → commitment request created automatically. Ownership at every stage from the first quote to the final payment. One process. No chasing.",
              },
            ].map((c) => (
              <div key={c.label} className={`rounded-xl border p-6 ${c.bg} ${c.border}`}>
                <div className="text-2xl mb-3">{c.icon}</div>
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${c.color}`}>{c.label}</p>
                <p className="text-xs text-muted-foreground mb-3">{c.who}</p>
                <p className="text-sm font-medium leading-relaxed">{c.outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">How TrailBill works</h2>
          <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
            One link. Your client chooses a date. Ownership transfers. The awkward conversation disappears.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 font-bold">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commit moment */}
      <section className="py-16 bg-muted/30 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">The moment that changes everything</p>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                A chosen commitment.<br />Not a vague promise.
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                You set the window — that is your boundary. Your client picks a date inside it. That act of choosing is what makes the difference. They decided. They own it. They follow through.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If they go past your due date, a late fee is added automatically. The moment they commit, you get notified. Everything after that runs without you.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  "You set the terms — the client cannot exceed them without a fee",
                  "They cannot say they forgot — they chose the date themselves",
                  "Every follow-up after commitment is handled automatically",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-lg w-full max-w-[320px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount due</p>
                    <p className="text-xl font-bold text-primary">R 2,500</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Latest by</p>
                    <p className="text-sm font-semibold">25 May</p>
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mb-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    🎁 You have 3 free grace days — pick any date, nothing extra added.
                  </p>
                </div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Pick your payment date</p>
                <div className="grid grid-cols-6 gap-1 mb-4">
                  {["20","21","22","23","24","25"].map((d) => (
                    <div key={d} className={`text-center text-xs py-2 rounded-lg font-semibold ${d === "22" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{d}</div>
                  ))}
                </div>
                <button className="w-full bg-primary text-primary-foreground text-sm font-bold py-3 rounded-xl">
                  Confirm — I&apos;ll pay on the 22nd
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">Their word. Their date. Their ownership.</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Proposals */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center order-2 md:order-1">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-lg w-full max-w-[320px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Proposal</p>
                    <p className="text-sm font-bold mt-0.5">ABC Tutoring — May</p>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">Awaiting response</span>
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Monthly tuition", amount: "R 2,500", selected: true },
                    { label: "Monthly tuition + materials", amount: "R 2,900", selected: false },
                  ].map((opt) => (
                    <div key={opt.label} className={`flex items-center justify-between p-2.5 rounded-xl border text-sm ${opt.selected ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                      <span className={opt.selected ? "font-semibold" : "text-muted-foreground"}>{opt.label}</span>
                      <span className={`font-bold ${opt.selected ? "text-primary" : "text-muted-foreground"}`}>{opt.amount}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button className="bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl">Accept</button>
                  <button className="bg-muted text-foreground text-xs font-semibold py-2.5 rounded-xl border border-border">Counter</button>
                  <button className="bg-muted text-destructive text-xs font-semibold py-2.5 rounded-xl border border-border">Decline</button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-3">Responds by link — no awkward call needed.</p>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Before the work begins</p>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Get commitment<br />before you start.
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Send a professional proposal. Your client accepts, proposes a counter, or declines — clearly, by link. Not a voice note. Not a maybe.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You only start work when there is a clear, formal yes. That single change protects your time and your income.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  "Proposal sent and tracked — no more guessing who\'s serious",
                  "Client accepts, counters, or declines on record",
                  "Automatically creates a commitment request when accepted",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 bg-muted/30 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              One plan. You only spend credits when you send a commitment request — everything that follows is free.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">

            {/* Main plan card */}
            <div className="bg-card rounded-2xl border-2 border-primary p-8 relative shadow-lg shadow-primary/10">
              <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                Full access
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-bold">R799</span>
                <span className="text-muted-foreground mb-1.5">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Includes <span className="font-semibold text-foreground">100 credits</span> — resets every month
              </p>

              <div className="space-y-2 mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">What costs a credit</p>
                {[
                  { icon: <Mail className="w-4 h-4 text-primary" />, label: "Commitment request via Email", cost: "1 credit" },
                  { icon: <MessageCircle className="w-4 h-4 text-[#25D366]" />, label: "Commitment request via WhatsApp", cost: "2 credits" },
                  { icon: <Smartphone className="w-4 h-4 text-purple-500" />, label: "Commitment request via SMS", cost: "2 credits" },
                  { icon: <><Mail className="w-4 h-4 text-primary" /><MessageCircle className="w-4 h-4 text-[#25D366]" /></>, label: "Email + WhatsApp combined", cost: "3 credits" },
                  { icon: <ClipboardList className="w-4 h-4 text-muted-foreground" />, label: "Proposal send", cost: "1–3 credits" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm flex items-center gap-1.5">
                      {row.icon}
                      {row.label}
                    </span>
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{row.cost}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-8">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Always free — no credits used</p>
                {[
                  "All follow-through after commitment is free",
                  "Automatic follow-up on every overdue date",
                  "Late fee enforcement & grace period system",
                  "Proposals (view, accept, counter, decline)",
                  "Cash flow calendar & payment tracking",
                  "Up to 20 clients · Groups & batch sending",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 mb-5 text-sm text-muted-foreground text-center">
                Recover one <span className="font-semibold text-foreground">R5,000</span> late payment and TrailBill pays for itself <span className="font-semibold text-foreground">6× over.</span>
              </div>
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors gap-2"
              >
                Request Access
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-center text-xs text-muted-foreground mt-3">We set up your account personally. No credit card needed to apply.</p>
            </div>

            {/* Credits explainer */}
            <div className="space-y-5">
              <div className="bg-card rounded-2xl border border-border p-6">
                <p className="text-sm font-semibold mb-1">How far do 100 credits go?</p>
                <p className="text-xs text-muted-foreground mb-4">A typical small business with 15–30 clients fits comfortably.</p>
                <div className="space-y-3">
                  {[
                    { label: "Email only", clients: "100 clients", calc: "100 × 1 credit", color: "bg-primary", pct: "100%" },
                    { label: "WhatsApp only", clients: "50 clients", calc: "50 × 2 credits", color: "bg-[#25D366]", pct: "50%" },
                    { label: "SMS only", clients: "50 clients", calc: "50 × 2 credits", color: "bg-purple-500", pct: "50%" },
                    { label: "Email + WhatsApp", clients: "33 clients", calc: "33 × 3 credits", color: "bg-amber-500", pct: "33%" },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{row.label}</span>
                        <span className="text-muted-foreground">{row.clients} · <span className="font-mono">{row.calc}</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{ width: row.pct }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">
                  Need more? Top-up credits available — or contact us for a custom plan.
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <p className="text-sm font-semibold mb-3">Credits only count when you send</p>
                <div className="space-y-2.5 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    Send a commitment request → credits deducted only on successful delivery
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    Notification fails to deliver — no credit charged
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    All follow-through after commitment runs free — always
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    Credits at 0? Existing commitments stay active, only new sends pause
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            The awkward payment conversation<br />ends here.
          </h2>
          <p className="text-muted-foreground mb-2 text-base">
            Your clients choose a date. They own it.
          </p>
          <p className="text-muted-foreground mb-8 text-base">
            TrailBill handles everything after. You focus on your business.
          </p>
          <Link
            href="/get-started"
            className="inline-flex items-center justify-center h-13 px-8 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors gap-2"
          >
            Stop Chasing Clients
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-muted-foreground mt-4">No credit card required to start.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Mobile: stacked center / Desktop: side by side */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            {/* Logo + copyright */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="" className="h-6 w-auto object-contain opacity-60" />
                <span className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} TrailBill</span>
              </div>
              <p className="text-xs text-muted-foreground italic">Commitment first. Follow-through built in.</p>
            </div>
            {/* Links — stacked into two rows on mobile */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
              {/* Action links */}
              <div className="flex items-center gap-5 text-sm">
                <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Log In</Link>
                <Link href="/get-started" className="text-primary hover:text-primary/80 transition-colors font-medium">Get Early Access</Link>
              </div>
              {/* Divider — desktop only */}
              <div className="hidden sm:block w-px h-4 bg-border" />
              {/* Legal links */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Built by{" "}
              <a href="https://www.lunexweb.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                Lunexweb
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
