import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Public endpoint — no auth required. Uses service role to bypass RLS.
// Called by the /pay/[token] client component to log client-side events.
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { token, event_type, channel } = await request.json();

  if (!token || !event_type) {
    return NextResponse.json({ error: "token and event_type are required" }, { status: 400 });
  }

  const validEvents = ["pay_now_clicked", "extra_days_requested", "link_visited"];
  if (!validEvents.includes(event_type)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const { data: req } = await serviceClient
    .from("payment_requests")
    .select("id")
    .eq("public_token", token)
    .single();

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  await serviceClient.rpc("log_payment_event", {
    p_request_id:    req.id,
    p_event_type:    event_type,
    p_channel:       channel ?? null,
    p_reminder_type: null,
    p_metadata:      {},
  });

  return NextResponse.json({ success: true });
}
