import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const body = await request.json();

  // Support both single (requestId) and bulk (requestIds[]) delete
  const ids: string[] = body.requestIds
    ? body.requestIds
    : body.requestId
    ? [body.requestId]
    : [];

  if (ids.length === 0) return NextResponse.json({ error: "No request IDs provided" }, { status: 400 });

  // Fetch all requests being deleted (verify ownership + get batch_ids)
  const { data: existing } = await supabase
    .from("payment_requests")
    .select("id, batch_id")
    .in("id", ids)
    .eq("business_id", business.id);

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: "Requests not found" }, { status: 404 });
  }

  const verifiedIds = existing.map((r: any) => r.id);
  const affectedBatchIds = [...new Set(existing.map((r: any) => r.batch_id))];

  // Delete all in one query
  const { error } = await supabase
    .from("payment_requests")
    .delete()
    .in("id", verifiedIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Clean up any batches that are now empty
  for (const batchId of affectedBatchIds) {
    const { count } = await supabase
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId);
    if (count === 0) {
      await supabase.from("payment_batches").delete().eq("id", batchId);
    }
  }

  return NextResponse.json({ success: true, deleted: verifiedIds.length });
}
