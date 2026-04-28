import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { processBatchEmails } from "@/lib/process-batch";

async function handler(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const now = new Date().toISOString();

  const { data: dueBatches, error: fetchError } = await supabase
    .from("payment_batches")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!dueBatches || dueBatches.length === 0) return NextResponse.json({ processed: 0, emailed: 0, whatsapped: 0 });

  const batchIds = dueBatches.map(b => b.id);

  await supabase.from("payment_batches").update({ status: "sent" }).in("id", batchIds);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com").replace(/\/$/, "");
  try {
    const { emailed, whatsapped, failed } = await processBatchEmails(batchIds, supabase, appUrl);
    return NextResponse.json({ processed: batchIds.length, emailed, whatsapped, failed });
  } catch (err) {
    console.error("[process-scheduled] processBatchEmails threw:", err);
    return NextResponse.json({ error: String(err), processed: batchIds.length }, { status: 500 });
  }
}

export async function GET(request: Request) { return handler(request); }
export async function POST(request: Request) { return handler(request); }
