import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const { requestId, baseAmount, dueDate, scheduledAt, description, customNote, graceDays } = await request.json();

  if (!requestId) return NextResponse.json({ error: "Request ID is required" }, { status: 400 });

  // Verify ownership
  const { data: existing } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("id", requestId)
    .eq("business_id", business.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // Build update object
  const updates: Record<string, unknown> = {};

  if (baseAmount !== undefined) {
    const newBase = Number(baseAmount);
    const prevBalance = Number(existing.previous_balance ?? 0);
    const newTotal = Math.max(newBase + prevBalance, 0);
    const newOutstanding = Math.max(newTotal - Number(existing.amount_paid), 0);

    updates.base_amount = newBase;
    updates.total_due = newTotal;
    updates.outstanding = newOutstanding;

    // Update status based on new outstanding
    if (newOutstanding <= 0 && Number(existing.amount_paid) > 0) {
      updates.status = "paid";
    } else if (Number(existing.amount_paid) > 0 && newOutstanding > 0) {
      updates.status = "partial";
    }
  }

  if (dueDate !== undefined) {
    updates.due_date = dueDate;
    // Recalculate grace_end_date based on explicit graceDays or existing offset
    const baseDue = dueDate;
    const gDays = graceDays !== undefined ? Number(graceDays) : (
      existing.grace_end_date
        ? Math.round((new Date(existing.grace_end_date).getTime() - new Date(existing.due_date).getTime()) / 86400000)
        : 0
    );
    updates.grace_end_date = gDays > 0
      ? new Date(new Date(baseDue).getTime() + gDays * 86400000).toISOString().split("T")[0]
      : null;
  } else if (graceDays !== undefined) {
    const gDays = Number(graceDays);
    const baseDue = existing.due_date;
    updates.grace_end_date = gDays > 0
      ? new Date(new Date(baseDue).getTime() + gDays * 86400000).toISOString().split("T")[0]
      : null;
  }

  if (description !== undefined) updates.description = description;
  if (customNote !== undefined) updates.custom_note = customNote;

  if (Object.keys(updates).length === 0 && scheduledAt === undefined) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("payment_requests")
      .update(updates)
      .eq("id", requestId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (scheduledAt !== undefined) {
    const { error: batchError } = await supabase
      .from("payment_batches")
      .update({ scheduled_at: scheduledAt })
      .eq("id", existing.batch_id);

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
