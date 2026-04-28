"use client";

import { useState, useMemo } from "react";
import { Search, CalendarCheck, ChevronLeft, ChevronRight, Mail, Smartphone } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  reliability_score: number | null;
  average_days_to_pay: number | null;
  inferred_payday_day: number | null;
  payday_confidence: number | null;
  preferred_channel: string | null;
}

interface EventCounts {
  link_visited: number;
  pay_now_clicked: number;
  extra_days_requested: number;
  payment_recorded: number;
}

interface InsightsClientTableProps {
  clients: ClientRow[];
  eventMap: Record<string, EventCounts>;
}

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email:    Mail,
  whatsapp: Smartphone,
};

function ScoreDots({ score }: { score: number | null }) {
  if (!score) return <span className="text-xs text-muted-foreground/50">No history</span>;
  const s = Math.round(score);
  const color = s >= 4 ? "bg-primary" : s >= 3 ? "bg-amber-400" : "bg-destructive";
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < s ? color : "bg-muted"}`} />
      ))}
    </div>
  );
}

const PAGE_SIZE = 10;

export function InsightsClientTable({ clients, eventMap }: InsightsClientTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clients.filter(c => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const visible    = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">How each client behaves</h3>
            <p className="text-xs text-muted-foreground">
              {filtered.length} client{filtered.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search clients…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring w-[160px]"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No clients match "{search}"</p>
        ) : visible.map(c => {
          const ev = eventMap[c.id] ?? { link_visited: 0, pay_now_clicked: 0, extra_days_requested: 0, payment_recorded: 0 };
          const ChIcon = c.preferred_channel ? (CHANNEL_ICON[c.preferred_channel] ?? Mail) : null;
          const ordinal = (n: number) => ["st","nd","rd"][((n % 10) - 1)] ?? "th";
          return (
            <div key={c.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {c.inferred_payday_day && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CalendarCheck className="w-2.5 h-2.5" />
                      ~{c.inferred_payday_day}{ordinal(c.inferred_payday_day)}
                    </span>
                  )}
                  {ChIcon && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5 capitalize">
                      <ChIcon className="w-2.5 h-2.5" />
                      {c.preferred_channel}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-4 text-center flex-shrink-0">
                <div title="Link visits">
                  <p className="text-xs font-semibold">{ev.link_visited}</p>
                  <p className="text-[10px] text-muted-foreground">visits</p>
                </div>
                <div title="Pay Now clicked">
                  <p className="text-xs font-semibold">{ev.pay_now_clicked}</p>
                  <p className="text-[10px] text-muted-foreground">clicked</p>
                </div>
                <div title="Extra days requested">
                  <p className="text-xs font-semibold">{ev.extra_days_requested}</p>
                  <p className="text-[10px] text-muted-foreground">extra days</p>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <ScoreDots score={c.reliability_score} />
                {c.average_days_to_pay != null && (
                  <span className="text-[10px] text-muted-foreground">{c.average_days_to_pay}d avg</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {safePage + 1} of {totalPages} &nbsp;·&nbsp; {filtered.length} clients
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
