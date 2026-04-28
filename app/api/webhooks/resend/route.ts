import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const type: string = payload?.type ?? "";
    const emailId: string = payload?.data?.email_id ?? "";
    const to: string[] = payload?.data?.to ?? [];

    if (type === "email.bounced") {
      console.warn(`[resend-webhook] email.bounced — id:${emailId} to:${to.join(",")}`);
    } else if (type === "email.complained") {
      console.warn(`[resend-webhook] email.complained (spam) — id:${emailId} to:${to.join(",")}`);
    } else {
      console.log(`[resend-webhook] ${type} — id:${emailId}`);
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
