import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify admin role
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { leadId, email, password, fullName, businessName, subscriptionDays } = await request.json();

  // Use service role to create auth user
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "business" },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // Create business record
  const daysNum = Number(subscriptionDays) || 30;
  const end = new Date();
  end.setDate(end.getDate() + daysNum);

  const bizRecord: Record<string, unknown> = {
    owner_id:            userId,
    name:                businessName || fullName,
    email,
    subscription_start:  new Date().toISOString(),
    subscription_days:   daysNum,
    subscription_end:    end.toISOString().split("T")[0],
    subscription_active: true,
    credits_monthly:     100,
    credits_remaining:   100,
  };

  const { error: bizError } = await adminClient.from("businesses").insert(bizRecord);

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 400 });
  }

  // Update lead status (if converting from a lead)
  if (leadId) {
    await adminClient.from("leads").update({ status: "approved" }).eq("id", leadId);
  }

  return NextResponse.json({ success: true, userId });
}
