import { fmtMoney } from "@/lib/email-template";

type InitialTemplateName = "tb_pay_request";
type ReminderTemplateName = "tb_pay_followup";
type CommitmentTemplateName = "tb_pay_committed";
type ProposalTemplateName = "tb_proposal_send" | "tb_proposal_counter" | "tb_proposal_revised" | "tb_proposal_confirmed";
export type WhatsAppTemplateName = InitialTemplateName | ReminderTemplateName | CommitmentTemplateName | ProposalTemplateName;

type BodyValue = string | number;

type MetaErrorData = {
  error?: {
    message?: string;
    error_user_msg?: string;
    error_data?: { details?: string };
  };
};

export type WhatsAppSendResult = {
  sent: boolean;
  skipped: boolean;
  pendingApproval: boolean;
  providerMessageId?: string;
  reason?: string;
};

const SA_DEFAULT_COUNTRY_CODE = "27";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function templateLanguageMismatch(error: MetaErrorData) {
  const msg = [
    error.error?.message,
    error.error?.error_user_msg,
    error.error?.error_data?.details,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return msg.includes("language") && msg.includes("template");
}

function normalizePhoneForMeta(phone: string | null | undefined) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `${SA_DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  return digits;
}

function templatePendingApproval(error: MetaErrorData) {
  const msg = [
    error.error?.message,
    error.error?.error_user_msg,
    error.error?.error_data?.details,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return msg.includes("not approved")
    || msg.includes("template does not exist")
    || msg.includes("parameter name is missing or empty")
    || msg.includes("message template language");
}

function bodyText(value: BodyValue) {
  return String(value ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
}

function buildBodyParameters(values: BodyValue[]) {
  return values.map((v) => ({ type: "text", text: bodyText(v) }));
}

export function buildInitialWhatsAppMessage(args: {
  token: string;
  clientName: string;
  businessName: string;
  amount: number;
  requestNumber: string;
  dueDate: string;
  description: string | null;
  graceEndDate: string | null;
  lateFeePct: number | null;
  bizPhone?: string | null;
}) {
  const dueFmt = formatDate(args.dueDate);
  const description = args.description ?? "Monthly payment";
  const amountFmt = fmtMoney(args.amount);
  const hasGrace = !!args.graceEndDate;
  const hasLateFee = (args.lateFeePct ?? 0) > 0;

  let middleSection: string;
  if (hasGrace && hasLateFee) {
    middleSection = `Miss it \u2192 a flat ${Number(args.lateFeePct)}% late fee will be added.\n\n\uD83C\uDF81 You have free grace days until ${formatDate(args.graceEndDate)} \u2014 claim them now and pay ${amountFmt}, nothing added.`;
  } else if (hasGrace) {
    middleSection = `\uD83C\uDF81 You have free grace days until ${formatDate(args.graceEndDate)} \u2014 claim them now and pay ${amountFmt}, nothing added.`;
  } else {
    middleSection = `Tap below to view your banking details and pick your payment date.`;
  }

  return {
    template: "tb_pay_request" as const,
    bodyValues: [
      args.clientName,    // {{1}}
      args.businessName,  // {{2}}
      amountFmt,          // {{3}}
      dueFmt,             // {{4}}
      middleSection,      // {{5}}
      description,        // {{6}}
      args.requestNumber, // {{7}}
    ],
    buttonUrlToken: args.token,
  };
}

const REMINDER_INTROS: Record<string, (biz: string) => string> = {
  "1_day_before": (biz) => `Just a gentle reminder from *${biz}* \u2014 your payment is due *tomorrow*. If you have already arranged it, please ignore this \uD83D\uDE4F`,
  "due_date":     (biz) => `A kind reminder from *${biz}* \u2014 your payment is *due today*. Please make payment at your convenience.`,
  "1_day_after":  (biz) => `*${biz}* \u2014 we noticed your payment hasn't come through yet. No worries, please arrange it at your earliest convenience.`,
  "3_days_after": (biz) => `*${biz}* is following up on your payment, which is now *3 days overdue*. If you are experiencing difficulties, please reach out \u2014 we are happy to help \uD83D\uDE4F`,
  "7_days_after": (biz) => `*${biz}* is following up on your outstanding payment, now *7 days overdue*. Please arrange payment or contact us if you need any assistance.`,
};

export function buildReminderWhatsAppMessage(args: {
  token: string;
  reminderType: string;
  clientName: string;
  businessName: string;
  amount: number;
  requestNumber: string;
  dueDate: string;
  description: string | null;
  bizPhone?: string | null;
}) {
  const dueFmt = formatDate(args.dueDate);
  const description = args.description ?? "Monthly payment";
  const introFn = REMINDER_INTROS[args.reminderType];
  const intro = introFn
    ? introFn(args.businessName)
    : `A message from *${args.businessName}* regarding your outstanding payment.`;
  const bizContact = args.bizPhone
    ? `${args.businessName}: ${args.bizPhone}`
    : args.businessName;

  return {
    template: "tb_pay_followup" as const,
    bodyValues: [
      args.clientName,        // {{1}}
      intro,                  // {{2}}
      fmtMoney(args.amount),  // {{3}}
      dueFmt,                 // {{4}}
      description,            // {{5}}
      args.requestNumber,     // {{6}}
      bizContact,             // {{7}}
    ],
    buttonUrlToken: args.token,
  };
}

export function buildCommitmentConfirmationWhatsAppMessage(args: {
  token: string;
  clientName: string;
  businessName: string;
  amount: number;
  committedDate: string;
  description: string | null;
  requestNumber: string;
}) {
  const dateFmt = formatDate(args.committedDate);
  const amountFmt = fmtMoney(args.amount);
  const description = args.description ?? "Monthly payment";

  return {
    template: "tb_pay_committed" as const,
    bodyValues: [
      args.clientName,   // {{1}}
      args.businessName, // {{2}}
      amountFmt,         // {{3}}
      dateFmt,           // {{4}}
      description,       // {{5}}
      args.requestNumber, // {{6}}
    ],
    buttonUrlToken: args.token,
  };
}

export function buildProposalSendMessage(args: {
  publicToken: string;
  clientName: string;
  businessName: string;
  title: string;
}) {
  return {
    template: "tb_proposal_send" as const,
    bodyValues: [args.clientName, args.businessName, args.title],
    buttonUrlToken: args.publicToken,
  };
}

export function buildProposalCounterMessage(args: {
  reviewToken: string;
  businessName: string;
  clientName: string;
  title: string;
  counterAmount: string;
  originalAmount: string;
}) {
  return {
    template: "tb_proposal_counter" as const,
    bodyValues: [args.businessName, args.clientName, args.title, args.counterAmount, args.originalAmount],
    buttonUrlToken: args.reviewToken,
  };
}

export function buildProposalFinalOfferMessage(args: {
  publicToken: string;
  clientName: string;
  businessName: string;
  title: string;
}) {
  return {
    template: "tb_proposal_revised" as const,
    bodyValues: [args.clientName, args.businessName, args.title],
    buttonUrlToken: args.publicToken,
  };
}

export function buildProposalApprovedMessage(args: {
  clientName: string;
  businessName: string;
  title: string;
}) {
  return {
    template: "tb_proposal_confirmed" as const,
    bodyValues: [args.clientName, args.businessName, args.title],
    buttonUrlToken: null as string | null,
  };
}

export async function sendWhatsAppTemplate(args: {
  toPhone: string | null | undefined;
  template: WhatsAppTemplateName;
  bodyValues: BodyValue[];
  buttonUrlToken: string | null;
}) : Promise<WhatsAppSendResult> {
  const enabled = process.env.WHATSAPP_ENABLED === "true";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!enabled) {
    return { sent: false, skipped: true, pendingApproval: false, reason: "whatsapp_disabled" };
  }

  const isPlaceholder = (v: string) => !v || v.startsWith("your_") || v.length < 8;
  if (isPlaceholder(phoneNumberId ?? "") || isPlaceholder(accessToken ?? "")) {
    return { sent: false, skipped: true, pendingApproval: false, reason: "whatsapp_not_configured" };
  }

  const normalizedTo = normalizePhoneForMeta(args.toPhone);
  if (!normalizedTo) {
    return { sent: false, skipped: true, pendingApproval: false, reason: "invalid_phone" };
  }

  const endpoint = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  const configuredLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";
  const languagesToTry = configuredLanguage === "en" ? ["en"] : [configuredLanguage, "en"];

  for (const language of languagesToTry) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "template",
      template: {
        name: args.template,
        language: { code: language },
        components: [
          {
            type: "body",
            parameters: buildBodyParameters(args.bodyValues),
          },
          ...(args.buttonUrlToken != null ? [{
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: bodyText(args.buttonUrlToken) }],
          }] : []),
        ],
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      let data: { messages?: Array<{ id?: string }> } = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      return {
        sent: true,
        skipped: false,
        pendingApproval: false,
        providerMessageId: data.messages?.[0]?.id,
      };
    }

    let errorData: MetaErrorData = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = {};
    }

    if (templatePendingApproval(errorData)) {
      return { sent: false, skipped: true, pendingApproval: true, reason: "template_not_approved" };
    }

    // 401 = bad access token, 404 = invalid phone number ID — both are config problems, not delivery failures
    if (response.status === 401 || response.status === 404) {
      return { sent: false, skipped: true, pendingApproval: false, reason: "whatsapp_credentials_invalid" };
    }

    if (language !== "en" && templateLanguageMismatch(errorData)) {
      continue;
    }

    const details = errorData.error?.error_data?.details || errorData.error?.error_user_msg || errorData.error?.message;
    return {
      sent: false,
      skipped: false,
      pendingApproval: false,
      reason: details || `http_${response.status}`,
    };
  }

  return {
    sent: false,
    skipped: false,
    pendingApproval: false,
    reason: "language_fallback_exhausted",
  };
}
