import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password, businessName } = await req.json();
    if (!password || !businessName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify password by re-authenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (authError) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }

    // Verify business name matches
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.id)
      .single();
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
    if (business.name.trim().toLowerCase() !== businessName.trim().toLowerCase()) {
      return NextResponse.json({ error: "Business name does not match" }, { status: 403 });
    }

    // Delete business data — cascades handle related rows via FK
    const admin = createAdminClient();
    await supabase.from("businesses").delete().eq("id", business.id);

    // Delete the auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete account: " + deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
