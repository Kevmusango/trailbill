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

  const { groupId, month, year, clientIds, customAmounts, amountOverrideAll, dueDate: customDueDate, description, channels = "email", graceDays: graceDaysOverride, lateFeePct: lateFeePctOverride, finalDueDate: finalDueDateOverride } = await request.json();
  const amountOverrides: Record<string, number> = customAmounts ?? {};

  const { data: group } = await supabase
    .from("client_groups")
    .select("*")
    .eq("id", groupId)
    .eq("business_id", business.id)
    .single();

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const monthDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let computedDue = new Date(year, month - 1, group.due_day);
  if (computedDue <= today) computedDue = new Date(year, month, group.due_day);
  const dueDateStr = customDueDate ?? computedDue.toISOString().split("T")[0];

  const { data: allMembers } = await supabase
    .from("group_memberships")
    .select("*, clients(id, name, email, phone)")
    .eq("group_id", groupId)
    .eq("is_active", true);

  let members = allMembers ?? [];
  if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
    members = members.filter(m => {
      const client = m.clients as unknown as { id: string };
      return clientIds.includes(client?.id);
    });
  } else {
    const { data: existingBatch } = await supabase
      .from("payment_batches")
      .select("id")
      .eq("group_id", groupId)
      .eq("month", monthDate)
      .single();

    if (existingBatch) {
      return NextResponse.json({ error: "Requests already sent for this group this month" }, { status: 400 });
    }
  }

  if (members.length === 0) {
    return NextResponse.json({ error: "No matching members found" }, { status: 400 });
  }

  // Pre-compute valid requests (R0 filtered) so we know exact count for credit check
  const requestInserts = members.map((m) => {
    const client = m.clients as unknown as { id: string };
    const amount = amountOverrideAll ?? amountOverrides[client.id] ?? m.custom_amount ?? group.default_amount;
    const totalDue = Math.max(Number(amount), 0);
    return { client, amount, totalDue };
  }).filter(r => r.totalDue > 0);

  if (requestInserts.length === 0) {
    return NextResponse.json({ error: "All amounts are R0 — nothing to send" }, { status: 400 });
  }

  // Credit gate: check subscription + sufficient credits before creating anything
  const hasEmail    = ["email", "both", "email+sms", "all"].includes(channels);
  const hasWhatsApp = ["whatsapp", "both", "whatsapp+sms", "all"].includes(channels);
  const hasSMS      = ["sms", "email+sms", "whatsapp+sms", "all"].includes(channels);
  const creditCostPerRequest = (hasEmail ? 1 : 0) + (hasWhatsApp ? 2 : 0) + (hasSMS ? 2 : 0) || 1;
  const totalCreditCost = requestInserts.length * creditCostPerRequest;
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

  const seq = Date.now().toString(36).toUpperCase();
  const batchNumber = `TRB-${year}-${String(month).padStart(2, "0")}-${seq}`;
  const now = new Date().toISOString();

  const { data: batch, error: batchError } = await supabase
    .from("payment_batches")
    .insert({
      business_id: business.id,
      group_id: groupId,
      batch_number: batchNumber,
      description: description || `${group.name} — ${new Date(year, month - 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}`,
      month: monthDate,
      total_amount: requestInserts.reduce((sum, r) => sum + r.totalDue, 0),
      total_clients: requestInserts.length,
      scheduled_at: now,
      status: "sent",
    })
    .select()
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 400 });
  }

  const inserts = requestInserts.map((r, i) => {
    const { client, totalDue, amount } = r;
    return {
      batch_id: batch.id,
      business_id: business.id,
      client_id: client.id,
      request_number: `${batchNumber}-${client.id.slice(0, 4).toUpperCase()}`,
      public_token: `${batch.id.slice(0, 8)}-${client.id.slice(0, 8)}-${Date.now().toString(36)}-${i}`,
      base_amount: Number(amount),
      previous_balance: 0,
      total_due: totalDue,
      amount_paid: 0,
      outstanding: totalDue,
      due_date: dueDateStr,
      grace_end_date: (graceDaysOverride ?? group.grace_days ?? 0) > 0
        ? new Date(new Date(dueDateStr).getTime() + (graceDaysOverride ?? group.grace_days) * 86400000).toISOString().split("T")[0]
        : null,
      final_due_date: finalDueDateOverride ?? null,
      late_fee_pct: lateFeePctOverride ?? group.late_fee_pct ?? 0,
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
    description: `Sent ${createdRequests?.length ?? 0} payment requests for ${group.name}`,
    amount: batch.total_amount,
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
  } catch (e) {
    console.error("[send] notification error:", e);
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
    totalAmount: batch.total_amount,
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
