import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { proposalId } = await req.json();
    if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const { error } = await supabase
      .from("proposals")
      .delete()
      .eq("id", proposalId)
      .eq("business_id", business.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
