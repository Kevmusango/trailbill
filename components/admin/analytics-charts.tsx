"use client";

import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

interface MonthlyMoney {
  month: string;
  collected: number;
  billed: number;
  outstanding: number;
  projected?: boolean;
}

interface MonthlyRequests {
  month: string;
  sent: number;
  paid: number;
  overdue: number;
  committed: number;
}

interface MonthlyProposals {
  month: string;
  sent: number;
  accepted: number;
  expired: number;
  counter: number;
}

interface MonthlyGrowth {
  month: string;
  businesses: number;
  requests: number;
}

interface Props {
  money: MonthlyMoney[];
  requests: MonthlyRequests[];
  proposals: MonthlyProposals[];
  growth: MonthlyGrowth[];
}

const fmtR = (v: number) => `R${(v / 1000).toFixed(0)}k`;
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};
const cursorStyle = { fill: "hsl(var(--muted))", opacity: 0.4 };

export function AnalyticsCharts({ money, requests, proposals, growth }: Props) {
  return (
    <div className="space-y-6">

      {/* ── Collection vs Billed ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">Monthly Collection vs Billed</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Actual invoiced vs collected · <span className="text-muted-foreground/60">dashed = 3-month projection</span>
          </p>
        </div>
        <div className="p-4" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={money.map(m => ({
                ...m,
                billedActual:      m.projected ? null : m.billed,
                collectedActual:   m.projected ? null : m.collected,
                billedProj:        m.projected ? m.billed    : null,
                collectedProj:     m.projected ? m.collected : null,
              }))}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtR} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} cursor={cursorStyle} formatter={(v) => (v != null && v !== "") ? `R${Number(v).toLocaleString("en-ZA")}` : "—"} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {/* Actual */}
              <Area type="monotone" dataKey="billedActual"    name="Billed"           stroke="#6366f1" fill="url(#gradBilled)"    strokeWidth={2} dot={false} connectNulls={false} />
              <Area type="monotone" dataKey="collectedActual" name="Collected"         stroke="#10b981" fill="url(#gradCollected)" strokeWidth={2} dot={false} connectNulls={false} />
              {/* Projection — dashed, no fill */}
              <Area type="monotone" dataKey="billedProj"      name="Billed (proj)"    stroke="#6366f1" fill="none" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} strokeOpacity={0.5} />
              <Area type="monotone" dataKey="collectedProj"   name="Collected (proj)" stroke="#10b981" fill="none" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} strokeOpacity={0.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Request Pipeline ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">Request Pipeline per Month</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Requests sent, paid, committed, and overdue by month</p>
        </div>
        <div className="p-4" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={requests} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={cursorStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="sent"      name="Sent"      stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="paid"      name="Paid"      stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="committed" name="Committed" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="overdue"   name="Overdue"   stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Proposal Funnel Trend ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold">Proposal Outcomes per Month</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sent vs accepted, counter-offered, expired</p>
          </div>
          <div className="p-4" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={proposals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={cursorStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sent"     name="Sent"     fill="#6366f1" radius={[3,3,0,0]} />
                <Bar dataKey="accepted" name="Accepted" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="counter"  name="Counter"  fill="#f59e0b" radius={[3,3,0,0]} />
                <Bar dataKey="expired"  name="Expired"  fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Platform Growth ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold">Platform Growth</h3>
            <p className="text-xs text-muted-foreground mt-0.5">New businesses and requests sent per month</p>
          </div>
          <div className="p-4" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="biz" orientation="left"  tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                <YAxis yAxisId="req" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={cursorStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="biz" type="monotone" dataKey="businesses" name="Businesses" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="req" type="monotone" dataKey="requests"   name="Requests"   stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
