import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id, weekly_report_enabled, weekly_report_day, weekly_report_time, end_of_week_report_enabled, end_of_week_report_day, end_of_week_report_time, daily_digest_enabled, daily_digest_time")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  // Get today's reminders using the database function (SAST timezone)
  const { data: reminders, error: remindersError } = await supabase
    .rpc("get_todays_reminders", { business_uuid: business.id });

  if (remindersError) {
    console.error("Error fetching reminders:", remindersError);
    return NextResponse.json({ error: remindersError.message }, { status: 500 });
  }

  // Get scheduled sends for today (SAST timezone)
  const today = new Date().toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" });
  const todayStart = new Date(today + " 00:00:00");
  const todayEnd = new Date(today + " 23:59:59");

  const { data: scheduledSends } = await supabase
    .from("payment_batches")
    .select("id, batch_number, description, total_clients, total_amount, scheduled_at")
    .eq("business_id", business.id)
    .eq("status", "scheduled")
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  // Calculate next weekly report
  const now = new Date();
  const nowSAST = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const currentDay = nowSAST.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
  };

  let nextWeeklyReport = null;
  if (business.weekly_report_enabled) {
    const targetDay = dayMap[business.weekly_report_day];
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    
    const nextDate = new Date(nowSAST);
    nextDate.setDate(nextDate.getDate() + daysUntil);
    const [hours, minutes] = business.weekly_report_time.split(":");
    nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    nextWeeklyReport = {
      type: "weekly_report",
      day: business.weekly_report_day,
      time: business.weekly_report_time,
      nextSend: nextDate.toISOString(),
    };
  }

  let nextEndOfWeekReport = null;
  if (business.end_of_week_report_enabled) {
    const targetDay = dayMap[business.end_of_week_report_day];
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    
    const nextDate = new Date(nowSAST);
    nextDate.setDate(nextDate.getDate() + daysUntil);
    const [hours, minutes] = business.end_of_week_report_time.split(":");
    nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    nextEndOfWeekReport = {
      type: "end_of_week_report",
      day: business.end_of_week_report_day,
      time: business.end_of_week_report_time,
      nextSend: nextDate.toISOString(),
    };
  }

  // Group reminders by type
  const remindersByType = {
    one_day_before: reminders?.filter((r: any) => r.reminder_type === "1_day_before") ?? [],
    due_today: reminders?.filter((r: any) => r.reminder_type === "due_date") ?? [],
    one_day_overdue: reminders?.filter((r: any) => r.reminder_type === "1_day_after") ?? [],
    three_days_overdue: reminders?.filter((r: any) => r.reminder_type === "3_days_after") ?? [],
    seven_days_overdue: reminders?.filter((r: any) => r.reminder_type === "7_days_after") ?? [],
  };

  const totalReminders = reminders?.length ?? 0;
  const pendingReminders = reminders?.filter((r: any) => !r.already_sent).length ?? 0;

  return NextResponse.json({
    success: true,
    today: today,
    summary: {
      totalReminders,
      pendingReminders,
      scheduledSends: scheduledSends?.length ?? 0,
    },
    reminders: remindersByType,
    scheduledSends: scheduledSends ?? [],
    weeklyReports: {
      weekly: nextWeeklyReport,
      endOfWeek: nextEndOfWeekReport,
      dailyDigest: business.daily_digest_enabled ? {
        type: "daily_digest",
        time: business.daily_digest_time,
      } : null,
    },
  });
}
