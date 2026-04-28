import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "upcoming"; // 'upcoming' | 'today' | 'summary'

  // Determine SAST date range
  const nowSAST = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const todaySAST = new Date(nowSAST.getFullYear(), nowSAST.getMonth(), nowSAST.getDate());

  let rangeStart: Date;
  let rangeEnd: Date;

  if (mode === "summary") {
    // Friday: Mon–Fri of this week (include past + today)
    const dayOfWeek = todaySAST.getDay();
    const monday = new Date(todaySAST);
    monday.setDate(todaySAST.getDate() - ((dayOfWeek + 6) % 7));
    rangeStart = monday;
    rangeEnd = todaySAST;
  } else if (mode === "today") {
    // Tue–Thu: only today's events
    rangeStart = todaySAST;
    rangeEnd = todaySAST;
  } else {
    // Monday: today through next 7 days
    rangeStart = todaySAST;
    rangeEnd = new Date(todaySAST);
    rangeEnd.setDate(todaySAST.getDate() + 7);
  }

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Scheduled sends — include per-client payment requests for each batch
  const { data: scheduledSends } = await supabase
    .from("payment_batches")
    .select(`
      id, scheduled_at, total_clients, total_amount, description,
      payment_requests(id, outstanding, status, notification_channels, clients(name))
    `)
    .eq("business_id", business.id)
    .eq("status", "scheduled")
    .gte("scheduled_at", rangeStart.toISOString())
    .lte("scheduled_at", new Date(rangeEnd.getTime() + 86400000).toISOString())
    .order("scheduled_at", { ascending: true });

  // Payment requests with due dates in range
  const { data: dueRequests } = await supabase
    .from("payment_requests")
    .select("id, due_date, total_due, outstanding, status, notification_channels, clients(name)")
    .eq("business_id", business.id)
    .in("status", ["sent", "scheduled", "partial", "overdue"])
    .gte("due_date", fmt(rangeStart))
    .lte("due_date", fmt(rangeEnd))
    .order("due_date", { ascending: true });

  // Check reminder_log for which requests already have reminders sent
  const dueRequestIds = (dueRequests ?? []).map((r: any) => r.id);
  const { data: sentReminders } = dueRequestIds.length > 0
    ? await supabase
        .from("reminder_log")
        .select("request_id, channel, status")
        .in("request_id", dueRequestIds)
        .eq("status", "sent")
    : { data: [] };

  const sentSet = new Set((sentReminders ?? []).map((r: any) => r.request_id));

  // For summary mode: also include payments received this week
  let paymentsReceived: any[] = [];
  if (mode === "summary") {
    const { data: payments } = await supabase
      .from("payments")
      .select("id, amount, payment_date, clients(name)")
      .eq("business_id", business.id)
      .gte("payment_date", fmt(rangeStart))
      .lte("payment_date", fmt(rangeEnd))
      .order("payment_date", { ascending: true });
    paymentsReceived = payments ?? [];
  }

  // Group everything by date
  const byDate: Record<string, { scheduledSends: any[]; dueRequests: any[]; payments: any[] }> = {};

  const ensureDate = (d: string) => {
    if (!byDate[d]) byDate[d] = { scheduledSends: [], dueRequests: [], payments: [] };
  };

  scheduledSends?.forEach((s: any) => {
    const d = new Date(s.scheduled_at).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    ensureDate(d);
    byDate[d].scheduledSends.push(s);
  });

  dueRequests?.forEach((r: any) => {
    ensureDate(r.due_date);
    const ch = r.notification_channels ?? "both";
    byDate[r.due_date].dueRequests.push({
      ...r,
      should_send_email: ch === "email" || ch === "both",
      should_send_whatsapp: ch === "whatsapp" || ch === "both",
      reminder_sent: sentSet.has(r.id),
    });
  });

  paymentsReceived.forEach((p: any) => {
    ensureDate(p.payment_date);
    byDate[p.payment_date].payments.push(p);
  });

  const sortedDates = Object.keys(byDate).sort();

  return NextResponse.json({
    success: true,
    mode,
    rangeStart: fmt(rangeStart),
    rangeEnd: fmt(rangeEnd),
    weekActivity: sortedDates.map(date => ({
      date,
      ...byDate[date],
    })),
  });
}
