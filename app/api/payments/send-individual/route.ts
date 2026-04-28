import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { processBatchEmails } from "@/lib/process-batch";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id, credits_remaining, subscription_active, subscription_end")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const { clientIds, customAmounts, month, year, dueDate: customDueDate, description, channels = "email", graceDays = 0, lateFeePct = 0, finalDueDate = null } = await request.json();
  const amountOverrides: Record<string, number> = customAmounts ?? {};

  if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json({ error: "No clients provided" }, { status: 400 });
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("business_id", business.id)
    .in("id", clientIds);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ error: "No matching clients found" }, { status: 400 });
  }

  // Filter out R0 clients
  const validClients = clients.filter(c => {
    const amt = Number(amountOverrides[c.id] ?? 0);
    return amt > 0;
  });

  if (validClients.length === 0) {
    return NextResponse.json({ error: "All amounts are R0 — nothing to send" }, { status: 400 });
  }

  // Credit gate: check subscription + sufficient credits before creating anything
  const hasEmail    = ["email", "both", "email+sms", "all"].includes(channels);
  const hasWhatsApp = ["whatsapp", "both", "whatsapp+sms", "all"].includes(channels);
  const hasSMS      = ["sms", "email+sms", "whatsapp+sms", "all"].includes(channels);
  const creditCostPerRequest = (hasEmail ? 1 : 0) + (hasWhatsApp ? 2 : 0) + (hasSMS ? 2 : 0) || 1;
  const totalCreditCost = validClients.length * creditCostPerRequest;
  const currentCredits = business.credits_remaining ?? 0;
  const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  if (!business.subscription_active) {
    return NextResponse.json({ error: "Subscription inactive — contact support to activate" }, { status: 403 });
  }
  if (business.subscription_end && business.subscription_end <= todayDate) {
    return NextResponse.json({ error: "Subscription expired — contact support to renew" }, { status: 403 });
  }
  if (currentCredits < totalCreditCost) {
    return NextResponse.json({
      error: `Insufficient credits — need ${totalCreditCost}, have ${currentCredits}`,
    }, { status: 403 });
  }

  const monthDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDateStr = customDueDate ?? new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0];

  // Get or create "Individual" group
  let { data: individualGroup } = await supabase
    .from("client_groups")
    .select("id")
    .eq("business_id", business.id)
    .eq("name", "Individual")
    .single();

  if (!individualGroup) {
    const { data: created } = await supabase
      .from("client_groups")
      .insert({
        business_id: business.id,
        name: "Individual",
        default_amount: 0,
        due_day: 1,
        active_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        is_active: true,
      })
      .select()
      .single();
    individualGroup = created;
  }

  if (!individualGroup) {
    return NextResponse.json({ error: "Could not create individual group" }, { status: 500 });
  }

  const seq = Date.now().toString(36).toUpperCase();
  const batchNumber = `TRB-${year}-${String(month).padStart(2, "0")}-${seq}`;
  const now = new Date().toISOString();

  const totalAmount = validClients.reduce((sum, c) => sum + Number(amountOverrides[c.id] ?? 0), 0);

  const { data: batch, error: batchError } = await supabase
    .from("payment_batches")
    .insert({
      business_id: business.id,
      group_id: individualGroup.id,
      batch_number: batchNumber,
      description: description || `Individual — ${new Date(year, month - 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}`,
      month: monthDate,
      total_amount: totalAmount,
      total_clients: validClients.length,
      scheduled_at: now,
      status: "sent",
    })
    .select()
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 400 });
  }

  const inserts = validClients.map((client, i) => {
    const amount = Number(amountOverrides[client.id] ?? 0);
    return {
      batch_id: batch.id,
      business_id: business.id,
      client_id: client.id,
      request_number: `${batchNumber}-${client.id.slice(0, 4).toUpperCase()}`,
      public_token: `${batch.id.slice(0, 8)}-${client.id.slice(0, 8)}-${Date.now().toString(36)}-${i}`,
      base_amount: amount,
      previous_balance: 0,
      total_due: amount,
      amount_paid: 0,
      outstanding: amount,
      due_date: dueDateStr,
      grace_end_date: graceDays > 0
        ? new Date(new Date(dueDateStr).getTime() + graceDays * 86400000).toISOString().split("T")[0]
        : null,
      final_due_date: finalDueDate ?? null,
      late_fee_pct: lateFeePct ?? 0,
      status: "sent",
      notification_channels: channels,
    };
  });

  const { data: createdRequests, error: reqError } = await supabase
    .from("payment_requests")
    .insert(inserts)
    .select();

  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 400 });
  }

  await supabase.from("activity_log").insert({
    business_id: business.id,
    type: "request",
    description: `Sent ${createdRequests?.length ?? 0} individual payment requests`,
    amount: totalAmount,
  });

  // Send emails & WhatsApp first — only charge for what was actually delivered
  let emailed = 0;
  let whatsapped = 0;
  let smsSent = 0;
  let failed = 0;
  let skipped = 0;
  let skipReasons: string[] = [];
  let failReasons: string[] = [];
  let creditsCharged = 0;
  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com").replace(/\/$/, "");
    const result = await processBatchEmails([batch.id], supabase, appUrl);
    emailed = result.emailed;
    whatsapped = result.whatsapped;
    smsSent = result.smsSent;
    failed = result.failed;
    skipped = result.skipped;
    skipReasons = result.skipReasons;
    failReasons = result.failReasons;
    creditsCharged = result.creditsCharged;
  } catch (err) {
    console.error("Failed to process notifications:", err);
  }

  // Deduct only actual credits used (0 if nothing was delivered)
  if (creditsCharged > 0) {
    const adminDb = createAdminClient();
    await adminDb
      .from("businesses")
      .update({ credits_remaining: currentCredits - creditsCharged })
      .eq("id", business.id)
      .gte("credits_remaining", creditsCharged);
  }

  revalidatePath("/dashboard", "layout");

  return NextResponse.json({
    success: true,
    batchId: batch.id,
    requestCount: createdRequests?.length ?? 0,
    totalAmount,
    emailed,
    whatsapped,
    smsSent,
    failed,
    skipped,
    skipReasons,
    failReasons,
    creditsUsed: creditsCharged,
    creditsRemaining: currentCredits - creditsCharged,
  });
}
