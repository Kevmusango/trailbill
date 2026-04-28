import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { proposalId } = await req.json();
  if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, client_id, client_name, client_email, client_phone, business_id")
    .eq("id", proposalId)
    .eq("business_id", business.id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  // Already linked to an existing client — nothing to do
  if (proposal.client_id) {
    return NextResponse.json({ success: true, clientId: proposal.client_id, alreadyExists: true });
  }

  // Create new client from proposal details
  const { data: newClient, error } = await supabase
    .from("clients")
    .insert({
      business_id: business.id,
      name: proposal.client_name,
      email: proposal.client_email ?? null,
      phone: proposal.client_phone ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Link client back to the proposal so it can't be converted twice
  await supabase
    .from("proposals")
    .update({ client_id: newClient.id })
    .eq("id", proposal.id);

  return NextResponse.json({ success: true, clientId: newClient.id });
}
