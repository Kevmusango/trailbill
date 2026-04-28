import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("auto_anonymize_stale_clients");

  if (error) {
    console.error("Auto-anonymise failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(`Auto-anonymise: ${data} client(s) anonymised`);
  return NextResponse.json({ ok: true, anonymised: data });
}
