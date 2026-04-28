import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type WhatsAppStatus = {
  id?: string;
  status?: string;
  recipient_id?: string;
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string; details?: string }>;
};

type ReminderLogRow = {
  id: string;
  request_id: string;
  business_id: string;
  reminder_type: string;
  provider_status: string | null;
};

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function unixToIso(ts: string | undefined) {
  if (!ts) return new Date().toISOString();
  const n = Number(ts);
  if (Number.isNaN(n)) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

async function processStatusEvent(status: WhatsAppStatus) {
  const providerMessageId = status.id;
  const providerStatus = status.status?.toLowerCase();

  if (!providerMessageId || !providerStatus) return;

  const { data: reminder } = await serviceClient
    .from("reminder_log")
    .select("id, request_id, business_id, reminder_type, provider_status")
    .eq("channel", "whatsapp")
    .eq("provider_message_id", providerMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reminderRow = (reminder ?? null) as ReminderLogRow | null;
  if (!reminderRow) {
    console.warn(`[whatsapp-webhook] no reminder_log match for message id ${providerMessageId}`);
    return;
  }

  const updatePayload: {
    provider_status: string;
    provider_payload: Record<string, unknown>;
    status?: "failed";
  } = {
    provider_status: providerStatus,
    provider_payload: {
      message_id: providerMessageId,
      recipient_id: status.recipient_id ?? null,
      status: providerStatus,
      timestamp: unixToIso(status.timestamp),
      errors: status.errors ?? [],
    },
  };

  if (providerStatus === "failed") {
    updatePayload.status = "failed";
  }

  await serviceClient
    .from("reminder_log")
    .update(updatePayload)
    .eq("id", reminderRow.id);

  if (providerStatus === "delivered" || providerStatus === "read") {
    await serviceClient.rpc("log_payment_event", {
      p_request_id: reminderRow.request_id,
      p_event_type: providerStatus === "read" ? "whatsapp_read" : "whatsapp_delivered",
      p_channel: "whatsapp",
      p_reminder_type: reminderRow.reminder_type,
      p_metadata: {
        provider_message_id: providerMessageId,
        recipient_id: status.recipient_id ?? null,
        provider_status: providerStatus,
      },
    });
  }

  if (providerStatus === "failed") {
    const details = status.errors?.map((e) => e.details || e.title).filter(Boolean).join("; ") || "Unknown provider failure";

    await serviceClient.from("activity_log").insert({
      business_id: reminderRow.business_id,
      type: "reminder",
      description: `WhatsApp reminder failed (${reminderRow.reminder_type})`,
      metadata: {
        request_id: reminderRow.request_id,
        provider_message_id: providerMessageId,
        recipient_id: status.recipient_id ?? null,
        details,
      },
    });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
        for (const status of statuses) {
          await processStatusEvent(status as WhatsAppStatus);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[whatsapp-webhook] failed to process payload", error);
    return NextResponse.json({ received: true });
  }
}
