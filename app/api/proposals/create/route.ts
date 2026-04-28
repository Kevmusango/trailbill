import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    clientId, clientName, clientEmail, clientPhone,
    title, description, amount, paymentTerms,
    allowCounter, minCounterAmount, expiryDate,
  } = await req.json();

  if (!clientName || !title || !amount || !expiryDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      business_id:        business.id,
      client_id:          clientId || null,
      client_name:        clientName,
      client_email:       clientEmail || null,
      client_phone:       clientPhone || null,
      title,
      description:        description || null,
      amount:             Number(amount),
      payment_terms:      paymentTerms ?? [],
      allow_counter:      !!allowCounter,
      min_counter_amount: minCounterAmount ? Number(minCounterAmount) : null,
      expiry_date:        expiryDate,
    })
    .select("id, public_token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, token: data.public_token, id: data.id });
}
