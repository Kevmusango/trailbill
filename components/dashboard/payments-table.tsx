"use client";

import { useState, useMemo } from "react";
import { Trash2, CheckCircle, AlertTriangle, Inbox, Search, X, Mail, MessageCircle, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PaymentRequest {
  id: string;
  request_number: string;
  total_due: number;
  amount_paid: number;
  outstanding: number;
  due_date: string;
  committed_date: string | null;
  extra_days_requested: number;
  late_fee_pct: number | null;
  grace_end_date: string | null;
  final_due_date: string | null;
  description: string | null;
  committed_amount: number | null;
  needs_attention: boolean;
  client_id: string;
  status: string;
  created_at: string;
  notification_channels: string | null;
  channels_sent: string | null;
  clients: { name: string; phone: string | null } | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "outline" | "info" | "secondary" }> = {
  scheduled: { label: "Scheduled", variant: "outline" },
  sent:      { label: "Sent",      variant: "info" },
  opened:    { label: "Opened",    variant: "secondary" },
  committed: { label: "Committed", variant: "warning" },
  partial:   { label: "Partial",   variant: "warning" },
  paid:      { label: "Paid",      variant: "success" },
  overdue:   { label: "Overdue",   variant: "destructive" },
};

const STATUS_CHIPS = ["all", "sent", "paid", "overdue", "partial"];

interface PaymentsTableProps {
  requests: PaymentRequest[];
  businessId: string;
}

export function PaymentsTable({ requests, businessId }: PaymentsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMarkPaidOpen, setBulkMarkPaidOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkPaymentDate, setBulkPaymentDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }));
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Single-row actions
  const [markPaidTarget, setMarkPaidTarget] = useState<PaymentRequest | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }));
  const [deleteTarget, setDeleteTarget] = useState<PaymentRequest | null>(null);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = [r.clients?.name ?? "", r.request_number, r.status, String(r.total_due)].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [requests, search, statusFilter]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${data.deleted} request(s)`);
        setSelected(new Set());
        setBulkDeleteOpen(false);
        router.refresh();
      } else { toast.error(data.error || "Failed to delete"); }
    } catch { toast.error("Failed to delete"); }
    setLoading(false);
  };

  const handleBulkMarkPaid = async () => {
    setLoading(true);
    const supabase = createClient();
    let marked = 0;
    for (const id of selected) {
      const req = requests.find(r => r.id === id);
      if (!req || req.status === "paid") continue;
      const amt = Number(req.outstanding);
      if (isNaN(amt) || amt <= 0) continue;
      try {
        const { error } = await supabase.rpc("record_payment", {
          p_request_id: id,
          p_amount: amt,
          p_payment_date: bulkPaymentDate,
          p_method: "eft",
        });
        if (!error) marked++;
      } catch { /* skip */ }
    }
    toast.success(`Marked ${marked} request(s) as paid`);
    setSelected(new Set());
    setBulkMarkPaidOpen(false);
    setLoading(false);
    router.refresh();
  };

  const handleSingleMarkPaid = async () => {
    if (!markPaidTarget) return;
    setLoading(true);
    const supabase = createClient();
    const amt = Number(markPaidTarget.outstanding);
    try {
      const { error, data } = await supabase.rpc("record_payment", {
        p_request_id: markPaidTarget.id,
        p_amount: amt,
        p_payment_date: markPaidDate,
        p_method: "eft",
      });
      if (error) {
        console.error("record_payment error:", JSON.stringify(error), "message:", error.message, "code:", error.code, "details:", error.details, "hint:", error.hint);
        throw error;
      }
      toast.success("Marked as paid");
      setMarkPaidTarget(null);
      router.refresh();
    } catch (err) { console.error("mark paid catch:", err); toast.error("Failed to mark paid"); }
    setLoading(false);
  };

  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payments/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: [deleteTarget.id] }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Deleted");
        setDeleteTarget(null);
        router.refresh();
      } else { toast.error(data.error || "Failed to delete"); }
    } catch { toast.error("Failed to delete"); }
    setLoading(false);
  };

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

  if (requests.length === 0) {
    return (
      <div className="p-12 text-center">
        <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No payment requests yet</h3>
        <p className="text-muted-foreground">Create a group and send your first payment request</p>
      </div>
    );
  }

  const allSelected = selected.size === filtered.length && filtered.length > 0;

  return (
    <>
      {/* Filter bar */}
      <div className="px-4 pt-3 pb-2 border-b border-border space-y-2">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or ref..." className="pl-8 h-8 text-xs" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {requests.length}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_CHIPS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : (STATUS_MAP[s]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No requests match your filters.
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="ml-1 text-primary underline">Clear</button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/50 border-b border-border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setBulkMarkPaidOpen(true)} className="text-xs h-8 gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkDeleteOpen(true)} className="text-xs h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-border" />
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Client</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Amount</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Due Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Via</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(req => {
              const client = req.clients;
              const cfg = STATUS_MAP[req.status] ?? STATUS_MAP.sent;
              const isSelected = selected.has(req.id);
              return (
                <tr key={req.id} className={`border-b border-border last:border-0 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(req.id)} className="rounded border-border" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{client?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{req.request_number}</p>
                    {req.description && <p className="text-[11px] text-muted-foreground italic truncate max-w-[180px]">{req.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const committedAmt = req.committed_amount ? Number(req.committed_amount) : null;
                      const baseAmt = Number(req.total_due);
                      const hasAcceptedFee = committedAmt !== null && committedAmt > baseAmt;
                      const displayAmt = committedAmt ?? baseAmt;
                      return (
                        <>
                          <p className={`text-sm font-semibold ${hasAcceptedFee ? "text-amber-700" : ""}`}>
                            R{displayAmt.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {hasAcceptedFee && (
                            <>
                              <p className="text-[10px] text-muted-foreground line-through">
                                R{baseAmt.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className="text-[10px] text-amber-600">client accepted</p>
                            </>
                          )}
                          {!hasAcceptedFee && committedAmt !== null && (
                            <p className="text-[10px] text-green-600">accepted ✓</p>
                          )}
                          {committedAmt === null && Number(req.outstanding) > 0 && Number(req.outstanding) < baseAmt && (
                            <p className="text-xs text-destructive">R{Number(req.outstanding).toLocaleString("en-ZA")} left</p>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    {req.needs_attention && req.status !== "paid" && (
                      <p className="text-[10px] text-red-600 font-medium mt-0.5">⚠ Needs attention</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {req.committed_date && req.committed_date !== req.due_date.split("T")[0] ? (
                      <>
                        <p className="text-xs font-semibold text-amber-700">{fmtDate(req.committed_date)}</p>
                        <p className="text-[10px] text-muted-foreground line-through">{fmtDate(req.due_date)}</p>
                        <p className="text-[10px] text-amber-600">
                          {req.extra_days_requested > 0 ? `+${req.extra_days_requested}d extended` : "grace period"}
                        </p>
                      </>
                    ) : req.committed_date ? (
                      <>
                        <p className="text-xs text-muted-foreground">{fmtDate(req.due_date)}</p>
                        <p className="text-[10px] text-green-600">✓ committed</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">{fmtDate(req.due_date)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {(() => {
                        const delivered = req.channels_sent;
                        const requested = req.notification_channels ?? "email";
                        let hasEmail: boolean, hasWA: boolean, hasSMS: boolean;
                        if (delivered != null) {
                          hasEmail = delivered.includes("email");
                          hasWA    = delivered.includes("whatsapp");
                          hasSMS   = delivered.includes("sms");
                        } else {
                          const ch = requested;
                          hasEmail = ["email", "both", "email+sms", "all"].includes(ch);
                          hasWA    = ["whatsapp", "both", "whatsapp+sms", "all"].includes(ch);
                          hasSMS   = ["sms", "email+sms", "whatsapp+sms", "all"].includes(ch);
                        }
                        return (
                          <>
                            {hasEmail && <Mail className="w-3.5 h-3.5 text-blue-500" />}
                            {hasWA    && <MessageCircle className="w-3.5 h-3.5 text-green-600" />}
                            {hasSMS   && <Smartphone className="w-3.5 h-3.5 text-purple-500" />}
                            {!hasEmail && !hasWA && !hasSMS && <span className="text-[10px] text-muted-foreground">—</span>}
                          </>
                        );
                      })()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {req.status !== "paid" && (
                        <Button size="sm" variant="ghost" onClick={() => { setMarkPaidTarget(req); setMarkPaidDate(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })); }} className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(req)} className="h-7 px-2 text-[11px] gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="gap-3 max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete {selected.size} Request(s)</DialogTitle>
            <DialogDescription className="text-center">This cannot be undone.</DialogDescription>
          </DialogHeader>
          {loading && (
            <div className="px-1 pb-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Deleting…</span></div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full w-2/5"
                  style={{ animation: "deletion-slide 1.4s ease-in-out infinite" }} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={loading} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={loading} className="flex-1">
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk mark paid dialog */}
      <Dialog open={bulkMarkPaidOpen} onOpenChange={setBulkMarkPaidOpen}>
        <DialogContent className="gap-3 max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Mark {selected.size} as Paid</DialogTitle>
            <DialogDescription className="text-center">Each will be marked paid at their outstanding amount.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-xs font-medium">Payment date</label>
            <Input type="date" value={bulkPaymentDate} onChange={e => setBulkPaymentDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setBulkMarkPaidOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleBulkMarkPaid} disabled={loading} className="flex-1">
              {loading ? "Processing..." : "Mark Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Single mark paid dialog */}
      <Dialog open={!!markPaidTarget} onOpenChange={v => { if (!v) setMarkPaidTarget(null); }}>
        <DialogContent className="gap-3 max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Mark as Paid</DialogTitle>
            <DialogDescription className="text-center">
              {markPaidTarget?.clients?.name ?? "Unknown"} — R{Number(markPaidTarget?.outstanding ?? 0).toLocaleString("en-ZA")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-xs font-medium">Payment date</label>
            <Input type="date" value={markPaidDate} onChange={e => setMarkPaidDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setMarkPaidTarget(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleSingleMarkPaid} disabled={loading} className="flex-1">
              {loading ? "Processing..." : "Mark Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="gap-3 max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete Request</DialogTitle>
            <DialogDescription className="text-center">
              Delete request for {deleteTarget?.clients?.name ?? "Unknown"}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {loading && (
            <div className="px-1 pb-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Deleting…</span></div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full w-2/5"
                  style={{ animation: "deletion-slide 1.4s ease-in-out infinite" }} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={loading} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleSingleDelete} disabled={loading} className="flex-1">
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
