"use client";

import { useState, useMemo } from "react";
import { Users, ArrowLeft, Send, Check, Zap, Mail, Smartphone, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SendPreview } from "@/components/dashboard/send-preview";

interface GroupMember {
  clientId: string;
  clientName: string;
  defaultAmount: number;
}

interface Group {
  id: string;
  name: string;
  default_amount: number;
  due_day: number;
  members: GroupMember[];
}

interface Props {
  groups: Group[];
  ungroupedClients?: GroupMember[];
  businessName: string;
  creditsRemaining?: number;
  creditsMonthly?: number;
  subscriptionActive?: boolean;
  defaultGroupId?: string;
  enabledEmail?: boolean;
  enabledWhatsApp?: boolean;
  enabledSMS?: boolean;
}

export function SendRequestsFullPage({
  groups,
  ungroupedClients = [],
  businessName,
  creditsRemaining = 0,
  creditsMonthly = 100,
  subscriptionActive = false,
  defaultGroupId,
  enabledEmail = true,
  enabledWhatsApp = true,
  enabledSMS = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"group" | "individual">("group");
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupId ?? "");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [chEmail, setChEmail] = useState(enabledEmail);
  const [chWhatsApp, setChWhatsApp] = useState(enabledWhatsApp);
  const [chSMS, setChSMS] = useState(enabledSMS);

  const channels = chEmail && chWhatsApp && chSMS ? "all"
    : chEmail && chWhatsApp ? "both"
    : chEmail && chSMS ? "email+sms"
    : chWhatsApp && chSMS ? "whatsapp+sms"
    : chSMS ? "sms"
    : chWhatsApp ? "whatsapp"
    : "email";

  const creditCostPerRequest = (chEmail ? 1 : 0) + (chWhatsApp ? 2 : 0) + (chSMS ? 2 : 0) || 1;
  const [description, setDescription] = useState("");
  const [sameAmount, setSameAmount] = useState("");
  const [graceDays, setGraceDays] = useState("");
  const [lateFeePct, setLateFeePct] = useState("");
  const [finalDueDate, setFinalDueDate] = useState("");
  const router = useRouter();

  type SendResult = {
    requestCount: number;
    emailed: number;
    whatsapped: number;
    smsSent: number;
    failReasons: string[];
    skipReasons: string[];
    creditsUsed: number;
    creditsRemaining: number;
  };
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const selectedGroupData = groups.find(g => g.id === selectedGroup);

  const allClients = useMemo(() => {
    const map = new Map<string, GroupMember & { groupId: string; groupName: string }>();
    groups.forEach(g => {
      g.members.forEach(m => {
        if (!map.has(m.clientId)) {
          map.set(m.clientId, { ...m, groupId: g.id, groupName: g.name });
        }
      });
    });
    ungroupedClients.forEach(c => {
      if (!map.has(c.clientId)) {
        map.set(c.clientId, { ...c, groupId: "", groupName: "No group" });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [groups, ungroupedClients]);

  const toggleClient = (id: string) => {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!description.trim()) { toast.error("Describe what this payment is for"); return; }
    if (!chEmail && !chWhatsApp && !chSMS) { toast.error("Select at least one channel"); return; }

    if (mode === "group") {
      if (!selectedGroup) { toast.error("Select a group"); return; }
      setLoading(true);
      try {
        const res = await fetch("/api/payments/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: selectedGroup,
            month: currentMonth,
            year: currentYear,
            channels,
            description,
            dueDate,
            ...(sameAmount ? { amountOverrideAll: Number(sameAmount) } : {}),
            ...(graceDays ? { graceDays: Number(graceDays) } : {}),
            ...(lateFeePct ? { lateFeePct: Number(lateFeePct) } : {}),
            ...(finalDueDate ? { finalDueDate } : {}),
          }),
        });
        const data = await res.json();
        if (data.error) { toast.error(data.error); }
        else {
          if (typeof data.creditsRemaining === "number") {
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: data.creditsRemaining } }));
          }
          setSendResult({
            requestCount: data.requestCount ?? 0,
            emailed:      data.emailed ?? 0,
            whatsapped:   data.whatsapped ?? 0,
            smsSent:      data.smsSent ?? 0,
            failReasons:  data.failReasons ?? [],
            skipReasons:  data.skipReasons ?? [],
            creditsUsed:  data.creditsUsed ?? 0,
            creditsRemaining: data.creditsRemaining ?? 0,
          });
        }
      } catch { toast.error("Failed to send"); }
      setLoading(false);
      return;
    }

    // Individual mode
    if (selectedClients.length === 0) { toast.error("Select at least one client"); return; }
    setLoading(true);

    const overrides: Record<string, number> = {};
    selectedClients.forEach(cId => {
      const val = customAmounts[cId];
      if (val) overrides[cId] = Number(val);
    });

    const byGroup = new Map<string, string[]>();
    const ungroupedIds: string[] = [];
    selectedClients.forEach(cId => {
      const client = allClients.find(c => c.clientId === cId);
      if (!client || !client.groupId) { ungroupedIds.push(cId); return; }
      const arr = byGroup.get(client.groupId) ?? [];
      arr.push(cId);
      byGroup.set(client.groupId, arr);
    });

    let totalSent = 0;
    let totalEmailed = 0;
    let totalWhatsapped = 0;
    let totalSmsSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let allFailReasons: string[] = [];
    let allSkipReasons: string[] = [];
    let lastCreditsUsed = 0;
    let lastCreditsRemaining = creditsRemaining;

    for (const [gId, cIds] of byGroup) {
      try {
        const groupOverrides: Record<string, number> = {};
        cIds.forEach(id => { if (overrides[id] !== undefined) groupOverrides[id] = overrides[id]; });
        const res = await fetch("/api/payments/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: gId,
            month: currentMonth,
            year: currentYear,
            clientIds: cIds,
            customAmounts: Object.keys(groupOverrides).length > 0 ? groupOverrides : undefined,
            channels,
            description,
            dueDate,
            ...(graceDays ? { graceDays: Number(graceDays) } : {}),
            ...(lateFeePct ? { lateFeePct: Number(lateFeePct) } : {}),
            ...(finalDueDate ? { finalDueDate } : {}),
          }),
        });
        const data = await res.json();
        if (data.success) {
          totalSent += data.requestCount;
          totalEmailed += data.emailed ?? 0;
          totalWhatsapped += data.whatsapped ?? 0;
          totalSmsSent += data.smsSent ?? 0;
          totalFailed += data.failed ?? 0;
          totalSkipped += data.skipped ?? 0;
          allFailReasons = allFailReasons.concat(data.failReasons ?? []);
          allSkipReasons = allSkipReasons.concat(data.skipReasons ?? []);
          lastCreditsUsed += data.creditsUsed ?? 0;
          lastCreditsRemaining = data.creditsRemaining ?? lastCreditsRemaining;
        } else { toast.error(data.error); }
      } catch { toast.error("Network error — one or more group sends failed"); }
    }

    if (ungroupedIds.length > 0) {
      try {
        const ungroupedOverrides: Record<string, number> = {};
        ungroupedIds.forEach(id => { if (overrides[id] !== undefined) ungroupedOverrides[id] = overrides[id]; });
        const res = await fetch("/api/payments/send-individual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientIds: ungroupedIds,
            customAmounts: Object.keys(ungroupedOverrides).length > 0 ? ungroupedOverrides : undefined,
            month: currentMonth,
            year: currentYear,
            channels,
            description,
            dueDate,
            ...(graceDays ? { graceDays: Number(graceDays) } : {}),
            ...(lateFeePct ? { lateFeePct: Number(lateFeePct) } : {}),
            ...(finalDueDate ? { finalDueDate } : {}),
          }),
        });
        const data = await res.json();
        if (data.success) {
          totalSent += data.requestCount;
          totalEmailed += data.emailed ?? 0;
          totalWhatsapped += data.whatsapped ?? 0;
          totalSmsSent += data.smsSent ?? 0;
          totalFailed += data.failed ?? 0;
          totalSkipped += data.skipped ?? 0;
          allFailReasons = allFailReasons.concat(data.failReasons ?? []);
          allSkipReasons = allSkipReasons.concat(data.skipReasons ?? []);
          lastCreditsUsed += data.creditsUsed ?? 0;
          lastCreditsRemaining = data.creditsRemaining ?? lastCreditsRemaining;
        } else { toast.error(data.error); }
      } catch { toast.error("Network error — individual send failed"); }
    }

    if (totalSent > 0) {
      if (lastCreditsUsed > 0) {
        window.dispatchEvent(new CustomEvent("credits-updated", { detail: { creditsRemaining: lastCreditsRemaining } }));
      }
      setSendResult({
        requestCount: totalSent,
        emailed:      totalEmailed,
        whatsapped:   totalWhatsapped,
        smsSent:      totalSmsSent,
        failReasons:  allFailReasons,
        skipReasons:  allSkipReasons,
        creditsUsed:  lastCreditsUsed,
        creditsRemaining: lastCreditsRemaining,
      });
    } else {
      toast.error("No requests were sent — check amounts are not R0");
    }
    setLoading(false);
  };

  const costPerRequest = creditCostPerRequest;
  const recipientCount = mode === "group"
    ? (groups.find(g => g.id === selectedGroup)?.members.length ?? 0)
    : selectedClients.length;
  const totalCreditsNeeded = costPerRequest * recipientCount;
  const creditsAfterSend   = creditsRemaining - totalCreditsNeeded;
  const canAfford          = subscriptionActive && creditsRemaining >= totalCreditsNeeded;

  const graceEndDatePreview = graceDays && Number(graceDays) > 0 && dueDate
    ? new Date(new Date(dueDate + "T00:00:00").getTime() + Number(graceDays) * 86400000).toISOString().split("T")[0]
    : null;
  const previewAmount = sameAmount ? Number(sameAmount) : (selectedGroupData?.default_amount ?? 5000);

  if (sendResult) {
    const hasIssues = sendResult.failReasons.length > 0 || sendResult.skipReasons.length > 0;
    return (
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className={`px-6 py-5 flex items-center gap-3 ${hasIssues ? "bg-amber-50 border-b border-amber-100" : "bg-emerald-50 border-b border-emerald-100"}`}>
            {hasIssues
              ? <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              : <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />}
            <div>
              <p className={`font-bold text-base ${hasIssues ? "text-amber-800" : "text-emerald-800"}`}>
                {hasIssues ? "Sent with some issues" : `${sendResult.requestCount} request${sendResult.requestCount !== 1 ? "s" : ""} sent successfully`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sendResult.creditsUsed > 0 ? `${sendResult.creditsUsed} credit${sendResult.creditsUsed !== 1 ? "s" : ""} used · ${sendResult.creditsRemaining} remaining` : "0 credits charged"}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Delivery summary */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Delivered</p>
              <div className="flex gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  sendResult.emailed > 0 ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                }`}>
                  <Mail className="w-3.5 h-3.5" />
                  Email: {sendResult.emailed}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  sendResult.whatsapped > 0 ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}>
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  WhatsApp: {sendResult.whatsapped}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  sendResult.smsSent > 0 ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
                }`}>
                  <Smartphone className="w-3.5 h-3.5" />
                  SMS: {sendResult.smsSent}
                </span>
              </div>
            </div>

            {/* Failures */}
            {sendResult.failReasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Failed to deliver</p>
                <div className="space-y-1.5">
                  {sendResult.failReasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                      <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{r}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">The payment request was still created — you can resend manually from the Payments page.</p>
              </div>
            )}

            {/* Skipped */}
            {sendResult.skipReasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Skipped</p>
                <div className="space-y-1.5">
                  {sendResult.skipReasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setSendResult(null)}>
              Send Another
            </Button>
            <Button className="flex-1" onClick={() => router.push("/dashboard/payments")}>
              View Payments
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Payments
      </Link>

      <h2 className="text-2xl font-bold mb-6">Send Payment Requests</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <div>

      {/* Mode tabs */}
      <div className="grid grid-cols-2 gap-1.5 bg-muted/30 rounded-lg p-1 mb-6 max-w-xs">
        {(["group", "individual"] as const).map(m => (
          <button
            key={m}
            onClick={() => { if (m === mode) return; setMode(m); setSelectedGroup(""); setSelectedClients([]); setSameAmount(""); setCustomAmounts({}); }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-all ${
              mode === m ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-background"
            }`}
          >
            <Users className="w-4 h-4" />
            {m === "group" ? "Group" : "Individual"}
          </button>
        ))}
      </div>

      {/* Channel selector */}
      <div className="space-y-1.5 mb-3">
        <span className="text-xs font-medium text-muted-foreground">Send via:</span>
        <div className="flex gap-2">
          {enabledEmail && (
            <button type="button" onClick={() => setChEmail(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-14 rounded-lg border-2 text-sm font-medium transition-colors ${
                chEmail ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border text-muted-foreground hover:border-primary/40"
              }`}>
              <Mail className="w-3.5 h-3.5" />
              <span className="text-xs">Email</span>
              <span className="text-[10px] font-normal opacity-80">1 credit</span>
            </button>
          )}
          {enabledWhatsApp && (
            <button type="button" onClick={() => setChWhatsApp(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-14 rounded-lg border-2 text-sm font-medium transition-colors ${
                chWhatsApp ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground hover:border-primary/40"
              }`}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              <span className="text-xs">WhatsApp</span>
              <span className="text-[10px] font-normal opacity-80">2 credits</span>
            </button>
          )}
          {enabledSMS && (
            <button type="button" onClick={() => setChSMS(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-14 rounded-lg border-2 text-sm font-medium transition-colors ${
                chSMS ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border text-muted-foreground hover:border-primary/40"
              }`}>
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-xs">SMS</span>
              <span className="text-[10px] font-normal opacity-80">2 credits</span>
            </button>
          )}
        </div>
        {!chEmail && !chWhatsApp && !chSMS && (
          <p className="text-xs text-red-500 font-medium">⚠ Select at least one channel</p>
        )}
      </div>

      {/* Credit cost indicator */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border mb-5 text-xs ${
        !subscriptionActive
          ? "bg-destructive/5 border-destructive/20 text-destructive"
          : recipientCount > 0 && !canAfford
          ? "bg-destructive/5 border-destructive/20 text-destructive"
          : "bg-muted/40 border-border text-muted-foreground"
      }`}>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          {!subscriptionActive ? (
            <span className="font-medium">Subscription inactive — sending is locked</span>
          ) : recipientCount === 0 ? (
            <span>
              <span className="font-semibold text-foreground">{costPerRequest} credit{costPerRequest > 1 ? "s" : ""}</span> per request
              {" "}({[chEmail && "Email", chWhatsApp && "WhatsApp", chSMS && "SMS"].filter(Boolean).join(" + ") || "none"})
            </span>
          ) : (
            <span>
              <span className="font-semibold text-foreground">{costPerRequest}</span> × {recipientCount} recipient{recipientCount > 1 ? "s" : ""}
              {" = "}
              <span className={`font-semibold ${
                !canAfford ? "text-destructive" : "text-foreground"
              }`}>{totalCreditsNeeded} credit{totalCreditsNeeded !== 1 ? "s" : ""}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={creditsAfterSend < 0 ? "text-destructive font-medium" : ""}>
            {creditsRemaining} remaining
          </span>
          {recipientCount > 0 && subscriptionActive && (
            <span className={creditsAfterSend < 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
              {" → "}{Math.max(0, creditsAfterSend)} after
            </span>
          )}
        </div>
      </div>

      {/* GROUP MODE */}
      {mode === "group" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select a group to send to all members</p>
          <div className="rounded-lg border border-border divide-y divide-border bg-card">
            {groups.filter(g => g.members.length > 0).length > 0 ? groups.filter(g => g.members.length > 0).map(g => (
              <label
                key={g.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  selectedGroup === g.id ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="group"
                  checked={selectedGroup === g.id}
                  onChange={() => setSelectedGroup(g.id)}
                  className="border-border"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{g.members.length} members · R{g.default_amount.toLocaleString("en-ZA")} default</span>
                </div>
                {selectedGroup === g.id && <Check className="w-4 h-4 text-primary" />}
              </label>
            )) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground mb-1">No groups with members found</p>
                <p className="text-xs text-muted-foreground">Go to <strong>Groups</strong> to create a group and add clients to it</p>
              </div>
            )}
          </div>
          {selectedGroup && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border">
              <label className="text-xs font-medium block mb-1">Override amount for all members (R) <span className="font-normal text-muted-foreground">— leave blank to use each member&apos;s default</span></label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Default: R${selectedGroupData?.default_amount.toLocaleString("en-ZA")}`}
                value={sameAmount}
                onChange={e => setSameAmount(e.target.value)}
                onWheel={e => e.currentTarget.blur()}
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* INDIVIDUAL MODE */}
      {mode === "individual" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="flex-1">
              <label className="text-xs font-medium block mb-1">Same amount for all (R)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500 — applies to all selected clients"
                value={sameAmount}
                onWheel={e => e.currentTarget.blur()}
                onChange={e => {
                  setSameAmount(e.target.value);
                  if (e.target.value) {
                    const overrides: Record<string, string> = {};
                    allClients.forEach(c => { overrides[c.clientId] = e.target.value; });
                    setCustomAmounts(overrides);
                  } else {
                    setCustomAmounts({});
                  }
                }}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Select clients to send to</p>
            <div className="flex gap-3">
              <button onClick={() => setSelectedClients(allClients.map(c => c.clientId))} className="text-xs text-primary hover:underline">Select all</button>
              <button onClick={() => setSelectedClients([])} className="text-xs text-muted-foreground hover:underline">Clear</button>
            </div>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border bg-card max-h-[400px] overflow-y-auto">
            {allClients.map(c => {
              const isSelected = selectedClients.includes(c.clientId);
              return (
                <div key={c.clientId} className={`px-4 py-3 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleClient(c.clientId)} className="rounded border-border" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{c.clientName}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">{c.groupName}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">R{c.defaultAmount.toLocaleString("en-ZA")}</span>
                  </label>
                  {isSelected && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">R</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(c.defaultAmount)}
                        value={customAmounts[c.clientId] ?? ""}
                        onChange={e => setCustomAmounts(prev => ({ ...prev, [c.clientId]: e.target.value }))}
                        onWheel={e => e.currentTarget.blur()}
                        className="h-8 text-sm max-w-40"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Description + Due Date + Grace + Late Fee */}
      <div className="mt-6 space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">What is this payment for? *</label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. January fees, deposit, product order..."
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              min={today}
              onChange={e => setDueDate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Client must pay by this date</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">🎁 Free Grace Days</label>
            <Input
              type="number"
              min="0"
              max="30"
              placeholder="e.g. 5"
              value={graceDays}
              onChange={e => setGraceDays(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Extra days client can choose — no charge</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Last Accepted Date</label>
            <Input
              type="date"
              value={finalDueDate}
              min={graceEndDatePreview ?? dueDate}
              onChange={e => setFinalDueDate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Daily fee applies from grace end to here</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">⚠️ Late Fee (% total)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 2"
              value={lateFeePct}
              onChange={e => setLateFeePct(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Total % — daily rate auto-calculated from grace end to last date</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          💡 These settings override group defaults for this send only. Clients see the grace days as a gift — it encourages them to commit to a date.
        </p>
      </div>

      {/* Send button */}
      <div className="flex justify-end gap-3 mt-6 pb-8">
        <Link href="/dashboard/payments">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          onClick={handleSend}
          disabled={loading || !canAfford || (!chEmail && !chWhatsApp && !chSMS) || (mode === "group" ? !selectedGroup : selectedClients.length === 0)}
          className="gap-2"
          title={!subscriptionActive ? "Subscription inactive" : !canAfford && recipientCount > 0 ? `Need ${totalCreditsNeeded} credits, have ${creditsRemaining}` : undefined}
        >
          <Send className="w-4 h-4" />
          {loading ? "Sending..." : mode === "group"
            ? `Send to ${selectedGroupData?.members.length ?? 0} Members${totalCreditsNeeded > 0 ? ` · ${totalCreditsNeeded} credit${totalCreditsNeeded !== 1 ? "s" : ""}` : ""}`
            : `Send to ${selectedClients.length} Client(s)${totalCreditsNeeded > 0 ? ` · ${totalCreditsNeeded} credit${totalCreditsNeeded !== 1 ? "s" : ""}` : ""}`
          }
        </Button>
      </div>
      </div>

      {/* Preview panel */}
      <div className="hidden lg:block">
        <SendPreview
          businessName={businessName}
          amount={previewAmount}
          dueDate={dueDate}
          graceEndDate={graceEndDatePreview}
          finalDueDate={finalDueDate || null}
          lateFeePct={Number(lateFeePct) || 0}
          description={description}
          channels={channels}
        />
      </div>
      </div>
    </div>
  );
}
