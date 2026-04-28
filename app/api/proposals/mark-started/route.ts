import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await req.json();
  if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });

  const { error } = await supabase
    .from("proposal_responses")
    .update({ project_started_at: new Date().toISOString() })
    .eq("proposal_id", proposalId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
