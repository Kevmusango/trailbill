import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const { mode, groupId, clientIds, month, year } = await request.json();

  if (!month || !year) {
    return NextResponse.json({ error: "Month and year required" }, { status: 400 });
  }

  const monthDate = `${year}-${String(month).padStart(2, "0")}-01`;
  let duplicateClientIds: string[] = [];

  if (mode === "batch") {
    // Check all active groups for this month
    const { data: groups } = await supabase
      .from("client_groups")
      .select("id, active_months")
      .eq("business_id", business.id)
      .eq("is_active", true);

    if (!groups || groups.length === 0) {
      return NextResponse.json({ duplicateCount: 0, duplicateClientIds: [] });
    }

    const eligibleGroupIds = groups
      .filter(g => (g.active_months as number[]).includes(month))
      .map(g => g.id);

    if (eligibleGroupIds.length === 0) {
      return NextResponse.json({ duplicateCount: 0, duplicateClientIds: [] });
    }

    // Check for existing batches for these groups
    const { data: existingBatches } = await supabase
      .from("payment_batches")
      .select("id, group_id")
      .eq("business_id", business.id)
      .in("group_id", eligibleGroupIds)
      .eq("month", monthDate);

    if (existingBatches && existingBatches.length > 0) {
      const batchIds = existingBatches.map(b => b.id);
      
      // Get all client IDs from these batches
      const { data: existingRequests } = await supabase
        .from("payment_requests")
        .select("client_id")
        .in("batch_id", batchIds);

      if (existingRequests) {
        duplicateClientIds = [...new Set(existingRequests.map(r => r.client_id))];
      }
    }

  } else if (mode === "group" && groupId) {
    // Check if this specific group already has a batch for this month
    const { data: existingBatch } = await supabase
      .from("payment_batches")
      .select("id")
      .eq("business_id", business.id)
      .eq("group_id", groupId)
      .eq("month", monthDate)
      .single();

    if (existingBatch) {
      // Get all client IDs from this batch
      const { data: existingRequests } = await supabase
        .from("payment_requests")
        .select("client_id")
        .eq("batch_id", existingBatch.id);

      if (existingRequests) {
        duplicateClientIds = existingRequests.map(r => r.client_id);
      }
    }

  } else if (mode === "individual" && clientIds && Array.isArray(clientIds)) {
    // Check if any of these specific clients already have requests for this month
    const { data: existingRequests } = await supabase
      .from("payment_requests")
      .select("client_id, batch_id")
      .eq("business_id", business.id)
      .in("client_id", clientIds);

    if (existingRequests && existingRequests.length > 0) {
      // Get the batch months to filter by month
      const batchIds = [...new Set(existingRequests.map(r => r.batch_id))];
      const { data: batches } = await supabase
        .from("payment_batches")
        .select("id, month")
        .in("id", batchIds)
        .eq("month", monthDate);

      if (batches && batches.length > 0) {
        const relevantBatchIds = batches.map(b => b.id);
        duplicateClientIds = existingRequests
          .filter(r => relevantBatchIds.includes(r.batch_id))
          .map(r => r.client_id);
      }
    }
  }

  return NextResponse.json({
    duplicateCount: duplicateClientIds.length,
    duplicateClientIds,
  });
}
