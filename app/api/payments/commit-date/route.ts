import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token, date, amount } = await request.json();

  if (!token || !date) {
    return NextResponse.json({ error: "Missing token or date" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: req } = await supabase
    .from("payment_requests")
    .select("id, due_date, committed_at")
    .eq("public_token", token)
    .single();

  if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (req.committed_at) return NextResponse.json({ error: "Already committed" }, { status: 400 });
  if (date > req.due_date) {
    return NextResponse.json({ error: "Date cannot be after the original due date" }, { status: 400 });
  }

  const { error } = await supabase
    .from("payment_requests")
    .update({
      committed_date: date,
      committed_amount: amount ?? null,
      extra_days_requested: 0,
      committed_at: new Date().toISOString(),
      status: "committed",
      updated_at: new Date().toISOString(),
    })
    .eq("public_token", token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, committed_date: date });
}
