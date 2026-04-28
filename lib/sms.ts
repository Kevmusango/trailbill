// lib/sms.ts — SMSPortal integration for TrailBill
// Docs: https://docs.smsportal.com/docs/rest
// Auth: Basic (base64 of ClientId:ApiSecret)
// Send: POST https://rest.smsportal.com/bulkmessages

const SMSPORTAL_BASE = "https://rest.smsportal.com";

export type SMSSendResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
};

// ── Phone normalisation (SA) ─────────────────────────────────
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 10) return "27" + digits.slice(1);
  if (digits.startsWith("27") && digits.length === 11) return digits;
  if (digits.length >= 10) return digits;
  return null;
}

// ── Core send ────────────────────────────────────────────────
export async function sendSMS(args: {
  to: string | null | undefined;
  message: string;
}): Promise<SMSSendResult> {
  const enabled = process.env.SMS_ENABLED === "true";
  const clientId = process.env.SMSPORTAL_CLIENT_ID;
  const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET;

  if (!enabled) return { sent: false, skipped: true, reason: "sms_disabled" };
  if (!clientId || !clientSecret) return { sent: false, skipped: true, reason: "sms_not_configured" };
  if (!args.to) return { sent: false, skipped: true, reason: "no_phone" };

  const destination = normalisePhone(args.to);
  if (!destination) return { sent: false, skipped: true, reason: "invalid_phone" };

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const res = await fetch(`${SMSPORTAL_BASE}/bulkmessages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [{ content: args.message, destination }],
      }),
    });

    if (res.ok) return { sent: true, skipped: false };

    const body = await res.json().catch(() => ({}));
    console.error("[SMS] send failed:", res.status, body);
    return { sent: false, skipped: false, reason: body?.message ?? `status_${res.status}` };
  } catch (err) {
    console.error("[SMS] network error:", err);
    return { sent: false, skipped: false, reason: "network_error" };
  }
}

// ── Proposal SMS builders (all ≤ 160 chars) ──────────────────

export function smsProposalSend(p: { clientName: string; businessName: string; title: string; url: string }) {
  return `Hi ${p.clientName}. ${p.businessName} sent you a proposal: ${p.title}. View: ${p.url}`;
}

export function smsProposalCounter(p: { ownerName: string; clientName: string; title: string; counterAmount: string; url: string }) {
  return `Hi ${p.ownerName}. ${p.clientName} countered on ${p.title} (${p.counterAmount}). Review: ${p.url}`;
}

export function smsProposalFinalOffer(p: { clientName: string; businessName: string; title: string; url: string }) {
  return `Hi ${p.clientName}. ${p.businessName} responded to your counter on ${p.title}. View: ${p.url}`;
}

export function smsProposalApproved(p: { clientName: string; businessName: string; title: string }) {
  return `Hi ${p.clientName}. Great news! ${p.businessName} approved your counter on ${p.title}. They'll contact you soon.`;
}

export function smsProposalDeclined(p: { ownerName: string; clientName: string; title: string }) {
  return `Hi ${p.ownerName}. ${p.clientName} declined your final offer on ${p.title}. You may contact them directly.`;
}
