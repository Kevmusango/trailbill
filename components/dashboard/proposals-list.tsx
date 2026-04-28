"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Clock, XCircle, MessageSquare, Rocket, ChevronDown, ChevronUp, Zap, Mail, Smartphone, Eye, Search, Trash2, MessageCircle, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentTerm = { label: string; parts?: number[] };

type ProposalResponse = {
  start_date: string;
  start_month_only: boolean;
  selected_payment_term: string | null;
  counter_amount: number | null;
  counter_note: string | null;
  project_started_at: string | null;
  responded_at: string;
};

type Proposal = {
  id: string;
  title: string;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  amount: number;
  status: string;
  expiry_date: string;
  public_token: string;
  created_at: string;
  allow_counter: boolean;
  min_counter_amount: number | null;
  channels_sent: string[];
  viewed_at: string | null;
  view_count: number;
  proposal_responses: ProposalResponse[];
};

type Client = { id: string; name: string; email: string | null; phone: string | null };

function fmtMoney(n: number) {
  return n.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtMonth(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  sent:              { label: "Sent",              color: "bg-blue-100 text-blue-700",   icon: Clock },
  viewed:            { label: "Viewed",            color: "bg-purple-100 text-purple-700", icon: Clock },
  accepted:          { label: "Accepted",          color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  revised_requested: { label: "Counter Received",  color: "bg-amber-100 text-amber-700", icon: MessageSquare },
  expired:           { label: "Expired",           color: "bg-red-100 text-red-600",    icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.sent;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function getNextMonths(count = 18) {
  const months: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      label: d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
    });
  }
  return months;
}

const PRESET_TERMS: PaymentTerm[] = [
  { label: "Pay in full" },
  { label: "50% upfront, 50% on completion", parts: [50, 50] },
  { label: "3 equal installments", parts: [33.33, 33.33, 33.34] },
];

function CreateProposalModal({ clients, onClose, onCreated, creditsRemaining = 0, subscriptionActive = false, enabledEmail = true, enabledWhatsApp = true, enabledSMS = false }: {
  clients: Client[];
  onClose: () => void;
  onCreated: (proposal: Proposal) => void;
  creditsRemaining?: number;
  subscriptionActive?: boolean;
  enabledEmail?: boolean;
  enabledWhatsApp?: boolean;
  enabledSMS?: boolean;
}) {
  const [useExisting, setUseExisting] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set(["Pay in full"]));
  const [customSplit, setCustomSplit] = useState({ upfront: 50, balance: 50 });
  const [allowCounter, setAllowCounter] = useState(false);
  const [minCounter, setMinCounter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [step, setStep] = useState<"form" | "send">("form");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sendViaEmail, setSendViaEmail] = useState(enabledEmail);
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(enabledWhatsApp);
  const [sendViaSMS, setSendViaSMS] = useState(enabledSMS);

  const today = new Date().toISOString().split("T")[0];

  const handleClientSelect = (id: string) => {
    setSelectedClientId(id);
    const c = clients.find(c => c.id === id);
    if (c) {
      setClientName(c.name);
      setClientEmail(c.email ?? "");
      setClientPhone(c.phone ?? "");
      setClientSearch(c.name);
      setClientDropOpen(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const toggleTerm = (label: string) => {
    setSelectedTerms(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const buildPaymentTerms = (): PaymentTerm[] => {
    return PRESET_TERMS
      .filter(t => selectedTerms.has(t.label))
      .map(t => {
        if (t.label === "50% upfront, 50% on completion") {
          const up = Math.min(99, Math.max(1, customSplit.upfront));
          const bal = 100 - up;
          return { label: `${up}% upfront, ${bal}% on completion`, parts: [up, bal] };
        }
        return t;
      });
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error("Enter a client name"); return; }
    if (!title.trim()) { toast.error("Enter a proposal title"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter a price greater than R0"); return; }
    if (!expiryDate) { toast.error("Set a valid-until date"); return; }
    if (expiryDate <= today) { toast.error("Valid-until date must be in the future"); return; }
    if (selectedTerms.size === 0) { toast.error("Select at least one payment term"); return; }
    if (allowCounter && minCounter && Number(minCounter) >= Number(amount)) {
      toast.error("Minimum counter amount must be less than the proposal price"); return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId || null,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || null,
          clientPhone: clientPhone.trim() || null,
          title: title.trim(),
          description: null,
          amount: Number(amount),
          paymentTerms: buildPaymentTerms(),
          allowCounter,
          minCounterAmount: allowCounter && minCounter ? Number(minCounter) : null,
          expiryDate,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error ?? "Failed to create proposal"); return; }
      setCreatedToken(data.token);
      setCreatedId(data.id);
      onCreated({
        id: data.id,
        title: title.trim(),
        client_id: selectedClientId || null,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
        amount: Number(amount),
        status: "sent",
        expiry_date: expiryDate,
        public_token: data.token,
        created_at: new Date().toISOString(),
        allow_counter: allowCounter,
        min_counter_amount: allowCounter && minCounter ? Number(minCounter) : null,
        channels_sent: [],
        viewed_at: null,
        view_count: 0,
        proposal_responses: [],
      });

      const pUrl = `${window.location.origin}/proposal/${data.token}`;

      if (sendViaEmail && clientEmail.trim()) {
        const emailRes = await fetch("/api/proposals/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId: data.id }),
        });
        const emailData = await emailRes.json();
        if (emailData.error) toast.error(emailData.error);
        else {
          toast.success("Email sent!");
          if (typeof emailData.creditsRemaining === "number") {
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: emailData.creditsRemaining } }));
          }
        }
      }

      if (sendViaWhatsApp && clientPhone.trim() && !sendViaEmail) {
        // WhatsApp-only: call API to deduct 2 credits
        const waRes = await fetch("/api/proposals/send-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId: data.id }),
        });
        const waData = await waRes.json();
        if (!waRes.ok) toast.error(waData.error ?? "Failed to send WhatsApp");
        else {
          if (waData.sent) toast.success("WhatsApp sent!");
          else if (waData.waUrl) {
            window.open(waData.waUrl, "_blank");
            toast.info("Opened WhatsApp — send the message to your client");
          }
          if (typeof waData.creditsRemaining === "number") {
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: waData.creditsRemaining } }));
          }
        }
      }

      if (sendViaSMS && clientPhone.trim()) {
        const smsRes = await fetch("/api/proposals/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId: data.id }),
        });
        const smsData = await smsRes.json();
        if (!smsRes.ok) toast.error(smsData.error ?? "Failed to send SMS");
        else {
          if (smsData.sent) toast.success("SMS sent!");
          if (typeof smsData.creditsRemaining === "number") {
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: smsData.creditsRemaining } }));
          }
        }
      }

      setStep("send");
    } finally { setSubmitting(false); }
  };

  const proposalUrl = createdToken ? `${typeof window !== "undefined" ? window.location.origin : "https://app.trailbill.com"}/proposal/${createdToken}` : "";

  const sendEmail = async () => {
    if (!clientEmail) { toast.error("No email address for this client"); return; }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/proposals/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: createdId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Email sent!");
        if (typeof data.creditsRemaining === "number") {
          window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: data.creditsRemaining } }));
        }
      } else toast.error(data.error ?? "Failed to send email");
    } finally { setSendingEmail(false); }
  };

  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);

  const sendWhatsApp = async () => {
    if (!clientPhone) { toast.error("No phone number for this client"); return; }
    setSendingWhatsApp(true);
    try {
      const res = await fetch("/api/proposals/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: createdId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send WhatsApp"); return; }
      if (data.sent) {
        toast.success("WhatsApp sent!");
      } else {
        // API not configured — open wa.me as fallback
        if (data.waUrl) window.open(data.waUrl, "_blank");
        toast.info("Opened WhatsApp — send the message to your client");
      }
      if (typeof data.creditsRemaining === "number") {
        window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: data.creditsRemaining } }));
      }
    } finally { setSendingWhatsApp(false); }
  };

  const sendSMSToClient = async () => {
    if (!clientPhone) { toast.error("No phone number for this client"); return; }
    setSendingSMS(true);
    try {
      const res = await fetch("/api/proposals/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: createdId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send SMS"); return; }
      if (data.sent) toast.success("SMS sent!");
      else toast.error(data.reason ?? "SMS not sent");
      if (typeof data.creditsRemaining === "number") {
        window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: data.creditsRemaining } }));
      }
    } finally { setSendingSMS(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(proposalUrl);
    setLinkCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (step === "send") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold">Send Proposal</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
          </div>
          <div className="px-4 py-5 space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Proposal created for <strong>{clientName}</strong>. Send it now:
            </p>
            <div className="space-y-2">
              {enabledEmail && (
                <button
                  onClick={sendEmail}
                  disabled={sendingEmail || !clientEmail || creditsRemaining < 1 || !subscriptionActive}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!subscriptionActive ? "Subscription inactive" : creditsRemaining < 1 ? "No credits remaining" : undefined}
                >
                  <Mail className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold">{sendingEmail ? "Sending…" : "Send via Email"}</p>
                    <p className="text-xs text-muted-foreground">{clientEmail || "No email — enter manually"}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">1 credit</span>
                </button>
              )}
              {enabledWhatsApp && (
                <button
                  onClick={sendWhatsApp}
                  disabled={sendingWhatsApp || !clientPhone || creditsRemaining < 2 || !subscriptionActive}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-border hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={creditsRemaining < 2 ? "Insufficient credits" : undefined}
                >
                  <MessageCircle className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold">{sendingWhatsApp ? "Sending…" : "Send via WhatsApp"}</p>
                    <p className="text-xs text-muted-foreground">{clientPhone || "No phone — enter manually"}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap">2 credits</span>
                </button>
              )}
              {enabledSMS && (
                <button
                  onClick={sendSMSToClient}
                  disabled={sendingSMS || !clientPhone || creditsRemaining < 2 || !subscriptionActive}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-border hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={creditsRemaining < 2 ? "Insufficient credits" : undefined}
                >
                  <Smartphone className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold">{sendingSMS ? "Sending…" : "Send via SMS"}</p>
                    <p className="text-xs text-muted-foreground">{clientPhone || "No phone — enter manually"}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 whitespace-nowrap">2 credits</span>
                </button>
              )}
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Link2 className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold">{linkCopied ? "Copied!" : "Copy Link"}</p>
                  <p className="text-xs text-muted-foreground">Share manually via any channel</p>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">free</span>
              </button>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold">New Proposal</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="px-4 py-1.5 space-y-1.5">
          {/* Client row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</label>
              {clients.length > 0 && (
                <button onClick={() => setUseExisting(e => !e)} className="text-xs text-primary underline">
                  {useExisting ? "Enter manually" : "Choose existing"}
                </button>
              )}
            </div>
            {useExisting && clients.length > 0 ? (
              <div className="relative">
                <input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientDropOpen(true); setSelectedClientId(""); }}
                  onFocus={() => setClientDropOpen(true)}
                  placeholder="Search client…"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none"
                />
                {clientDropOpen && filteredClients.length > 0 && (
                  <div className="absolute z-50 top-10 left-0 right-0 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleClientSelect(c.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" className="w-full h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none" />
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email (optional)" className="h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none" />
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Phone (optional)" className="h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposal title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Website Redesign" className="w-full h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none" />
          </div>

          {/* Amount + expiry */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount (R)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R</span>
                <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} onWheel={e => (e.target as HTMLElement).blur()} placeholder="0" className="w-full h-8 rounded-lg border border-input bg-background pl-7 pr-3 text-sm focus:outline-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valid until</label>
              <input type="date" min={today} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none" />
            </div>
          </div>

          {/* Payment terms — horizontal chips */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment terms</label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_TERMS.map(term => {
                const active = selectedTerms.has(term.label);
                const shortLabel = term.label === "50% upfront, 50% on completion" ? "Split" : term.label === "3 equal installments" ? "3 Installments" : term.label;
                return (
                  <button key={term.label} type="button" onClick={() => toggleTerm(term.label)}
                    className={`px-3 h-7 rounded-full border text-xs font-medium transition-colors ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}>
                    {active ? "✓ " : ""}{shortLabel}
                  </button>
                );
              })}
            </div>
            {selectedTerms.has("50% upfront, 50% on completion") && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="relative w-14">
                  <input type="number" inputMode="numeric" min={1} max={99} value={customSplit.upfront} onChange={e => { const v = Math.min(99, Math.max(1, Number(e.target.value))); setCustomSplit({ upfront: v, balance: 100 - v }); }} onWheel={e => (e.target as HTMLElement).blur()} className="w-full h-7 rounded border border-input bg-background px-2 pr-4 text-xs focus:outline-none" />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                <span className="text-xs text-muted-foreground">upfront +</span>
                <div className="relative w-14">
                  <input type="number" value={customSplit.balance} readOnly className="w-full h-7 rounded border border-input bg-muted px-2 pr-4 text-xs focus:outline-none cursor-not-allowed" />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                <span className="text-xs text-muted-foreground">on completion</span>
              </div>
            )}
          </div>

          {/* Counter offer */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" checked={allowCounter} onChange={e => setAllowCounter(e.target.checked)} className="rounded accent-primary" />
              <span className="text-sm font-medium">Allow counter offer</span>
            </label>
            {allowCounter && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Min:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={minCounter}
                      onChange={e => setMinCounter(e.target.value)}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                      className={`w-full h-7 rounded border pl-6 pr-2 text-sm focus:outline-none bg-background ${
                        allowCounter && minCounter && Number(minCounter) >= Number(amount || 0)
                          ? "border-red-400 bg-red-50 text-red-700"
                          : "border-input"
                      }`}
                    />
                  </div>
                </div>
                {allowCounter && minCounter && Number(minCounter) >= Number(amount || 0) && (
                  <p className="text-xs text-red-600 font-medium">⚠ Min must be less than R{Number(amount || 0).toLocaleString("en-ZA")}</p>
                )}
              </div>
            )}
          </div>

          {/* Send via */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send via</label>
            <div className="flex gap-1.5">
              {enabledEmail && (
                <button
                  type="button"
                  onClick={() => setSendViaEmail(v => !v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border-2 text-xs font-medium transition-colors ${
                    sendViaEmail ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  } ${!clientEmail ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!clientEmail}
                  title={!clientEmail ? "Enter email above" : ""}
                >
                  <Mail className="w-3.5 h-3.5 text-blue-500" /><span>Email</span><span className="text-[9px] opacity-60">·1cr</span>
                </button>
              )}
              {enabledWhatsApp && (
                <button
                  type="button"
                  onClick={() => setSendViaWhatsApp(v => !v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border-2 text-xs font-medium transition-colors ${
                    sendViaWhatsApp ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground"
                  } ${!clientPhone ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!clientPhone}
                  title={!clientPhone ? "Enter phone above" : ""}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-green-500" /><span>WhatsApp</span><span className="text-[9px] opacity-60">·2cr</span>
                </button>
              )}
              {enabledSMS && (
                <button
                  type="button"
                  onClick={() => setSendViaSMS(v => !v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border-2 text-xs font-medium transition-colors ${
                    sendViaSMS ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border text-muted-foreground"
                  } ${!clientPhone ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={!clientPhone}
                  title={!clientPhone ? "Enter phone above" : ""}
                >
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" /><span>SMS</span><span className="text-[9px] opacity-60">·2cr</span>
                </button>
              )}
            </div>
            {(() => {
              const totalCost = (sendViaEmail ? 1 : 0) + (sendViaWhatsApp ? 2 : 0) + (sendViaSMS ? 2 : 0);
              const blocked = !subscriptionActive || (totalCost > 0 && creditsRemaining < totalCost);
              return (
                <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs ${
                  !subscriptionActive ? "bg-destructive/10 text-destructive" :
                  blocked ? "bg-destructive/10 text-destructive" :
                  totalCost === 0 ? "bg-muted/60 text-muted-foreground" :
                  "bg-muted/60 text-muted-foreground"
                }`}>
                  <Zap className="w-3 h-3 flex-shrink-0" />
                  {!subscriptionActive
                    ? "Subscription inactive — cannot send"
                    : totalCost === 0
                      ? "Select a channel above to send"
                      : blocked
                        ? `Need ${totalCost} credit${totalCost !== 1 ? "s" : ""} — only ${creditsRemaining} remaining`
                        : <><strong className="text-foreground">{totalCost} credit{totalCost !== 1 ? "s" : ""}</strong>&nbsp;will be used &middot; {creditsRemaining - totalCost} remaining</>
                  }
                </div>
              );
            })()}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={(() => {
              if (submitting) return true;
              if (allowCounter && minCounter && Number(minCounter) >= Number(amount || 0)) return true;
              const cost = (sendViaEmail ? 1 : 0) + (sendViaWhatsApp ? 2 : 0) + (sendViaSMS ? 2 : 0);
              if (cost > 0 && (!subscriptionActive || creditsRemaining < cost)) return true;
              return false;
            })()}
          >
            {(() => {
              if (submitting) return "Creating…";
              const cost = (sendViaEmail ? 1 : 0) + (sendViaWhatsApp ? 2 : 0) + (sendViaSMS ? 2 : 0);
              return cost > 0 ? `Create & Send · ${cost} credit${cost !== 1 ? "s" : ""}` : "Create";
            })()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProposalCard({ proposal, onDelete, onConvert }: { proposal: Proposal; onDelete: (id: string) => void; onConvert: (id: string, clientId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(!!proposal.client_id);
  const response = proposal.proposal_responses?.[0];
  const proposalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/proposal/${proposal.public_token}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(proposalUrl);
    setCopying(true);
    toast.success("Link copied!");
    setTimeout(() => setCopying(false), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/proposals/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Proposal deleted"); onDelete(proposal.id); }
      else { toast.error(data.error ?? "Failed to delete"); setDeleting(false); setDeleteConfirm(false); }
    } catch { setDeleting(false); setDeleteConfirm(false); }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const res = await fetch("/api/proposals/convert-to-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const data = await res.json();
      if (data.success) {
        setConverted(true);
        onConvert(proposal.id, data.clientId);
        toast.success(
          data.alreadyExists
            ? "Client already in your billing system"
            : `${proposal.client_name} added to your clients!`
        );
      } else {
        toast.error(data.error ?? "Failed to add client");
      }
    } finally { setConverting(false); }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{proposal.client_name}</p>
            <StatusBadge status={proposal.status} />
            {proposal.channels_sent?.length > 0 && (
              <span className="flex items-center gap-1">
                {proposal.channels_sent.includes("email") && (
                  <span title="Sent via Email" className="w-4 h-4 rounded-sm bg-blue-100 flex items-center justify-center">
                    <Mail className="w-2.5 h-2.5 text-blue-600" />
                  </span>
                )}
                {proposal.channels_sent.includes("whatsapp") && (
                  <span title="Sent via WhatsApp" className="w-4 h-4 rounded-sm bg-green-100 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#16a34a" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </span>
                )}
                {proposal.channels_sent.includes("sms") && (
                  <span title="Sent via SMS" className="w-4 h-4 rounded-sm bg-blue-100 flex items-center justify-center">
                    <Smartphone className="w-2.5 h-2.5 text-blue-700" />
                  </span>
                )}
              </span>
            )}
            {proposal.view_count > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600" title={proposal.viewed_at ? `First opened ${fmtDate(proposal.viewed_at.split('T')[0])}` : ''}>
                <Eye className="w-2.5 h-2.5" />{proposal.view_count}×
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{proposal.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Sent {fmtDateTime(proposal.created_at)}
            {proposal.viewed_at && (
              <span className="ml-2 text-purple-600">· Opened {fmtDateTime(proposal.viewed_at)}</span>
            )}
          </p>
          <p className="text-base font-bold text-primary mt-1">{fmtMoney(Number(proposal.amount))}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={copyLink} className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            {copying ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={() => setDeleteConfirm(d => !d)}
            className={`p-1.5 rounded-lg transition-colors ${
              deleteConfirm ? "bg-red-100 text-red-600" : "text-muted-foreground hover:bg-red-50 hover:text-red-600"
            }`}
            title="Delete proposal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {deleteConfirm && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-0.5">Delete this proposal?</p>
          <p className="text-xs text-red-600 mb-3">
            This will permanently delete the proposal along with all follow-ups, reminders, and client responses. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-1.5 text-sm rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : "Yes, delete permanently"}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Valid until</p>
              <p className="font-medium">{fmtDate(proposal.expiry_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{fmtDate(proposal.created_at.split("T")[0])}</p>
            </div>
          </div>

          {response && (
            <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-xs">
              <p className="font-semibold text-sm">Client response</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Start</p>
                  <p className="font-medium">
                    {response.start_month_only ? fmtMonth(response.start_date) : fmtDate(response.start_date)}
                  </p>
                </div>
                {response.selected_payment_term && (
                  <div>
                    <p className="text-muted-foreground">Payment</p>
                    <p className="font-medium">{response.selected_payment_term}</p>
                  </div>
                )}
                {response.counter_amount && (
                  <div>
                    <p className="text-muted-foreground">Counter offer</p>
                    <p className="font-medium text-amber-700">{fmtMoney(Number(response.counter_amount))}</p>
                  </div>
                )}
                {response.counter_note && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Note</p>
                    <p className="italic">{response.counter_note}</p>
                  </div>
                )}
              </div>

              {(proposal.status === "accepted" || !!response?.start_date) && (
                converted ? (
                  <div className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 space-y-2">
                    <p className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      {proposal.client_name} is in your billing system
                    </p>
                    <p className="text-xs text-green-700 leading-snug">
                      Next step: add them to a billing group so you can send monthly payment requests.
                    </p>
                    <div className="flex gap-2 pt-0.5">
                      <a
                        href="/dashboard/groups"
                        className="flex-1 flex items-center justify-center h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                      >
                        Add to a Group →
                      </a>
                      <a
                        href="/dashboard/clients"
                        className="flex-1 flex items-center justify-center h-8 rounded-lg border border-green-300 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        View Client
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    <button
                      onClick={handleConvert}
                      disabled={converting}
                      className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {converting ? "Adding…" : `Add ${proposal.client_name} to Billing System →`}
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProposalsList({ proposals: initial, clients, creditsRemaining = 0, creditsMonthly = 100, subscriptionActive = false, isExpired = false, enabledEmail = true, enabledWhatsApp = true, enabledSMS = false }: {
  proposals: Proposal[];
  clients: Client[];
  creditsRemaining?: number;
  creditsMonthly?: number;
  subscriptionActive?: boolean;
  isExpired?: boolean;
  enabledEmail?: boolean;
  enabledWhatsApp?: boolean;
  enabledSMS?: boolean;
}) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const handleCreated = (p: Proposal) => {
    setProposals(prev => [p, ...prev]);
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    setProposals(prev => prev.filter(p => p.id !== id));
  };

  const handleConvert = (id: string, clientId: string) => {
    setProposals(prev => prev.map(p => p.id === id ? { ...p, client_id: clientId } : p));
  };

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "sent", label: "Sent" },
    { value: "viewed", label: "Viewed" },
    { value: "accepted", label: "Accepted" },
    { value: "revised_requested", label: "Counter" },
    { value: "expired", label: "Expired" },
  ];

  const filtered = proposals.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.client_name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {showCreate && (
        <CreateProposalModal
          clients={clients}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          creditsRemaining={creditsRemaining}
          subscriptionActive={subscriptionActive}
          enabledEmail={enabledEmail}
          enabledWhatsApp={enabledWhatsApp}
          enabledSMS={enabledSMS}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Proposals</h1>
          <p className="text-sm text-muted-foreground">{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          onClick={() => !isExpired && setShowCreate(true)}
          disabled={isExpired}
          className="gap-1.5"
          title={isExpired ? "Your plan has expired — renew to send proposals" : undefined}
        >
          <Plus className="w-4 h-4" />
          Send Proposal
        </Button>
      </div>

      {/* Search + status filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client or title…"
            className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 h-7 rounded-full text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">{proposals.length === 0 ? "No proposals yet" : "No proposals match your search"}</p>
          {proposals.length === 0 && <p className="text-sm mt-1">Send your first proposal to start collecting client commitments</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <ProposalCard key={p.id} proposal={p} onDelete={handleDelete} onConvert={handleConvert} />
          ))}
        </div>
      )}
    </div>
  );
}
