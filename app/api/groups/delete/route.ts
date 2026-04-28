import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { groupId } = await req.json();
    if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const { data: group } = await supabase
      .from("client_groups")
      .select("id, name")
      .eq("id", groupId)
      .eq("business_id", business.id)
      .single();

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (group.name === "Individual") return NextResponse.json({ error: "The Individual group cannot be deleted" }, { status: 403 });

    const { error } = await supabase
      .from("client_groups")
      .update({ is_active: false })
      .eq("id", groupId)
      .eq("business_id", business.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
