"use client";

import { useState } from "react";

interface SendPreviewProps {
  businessName: string;
  amount: number;
  dueDate: string;
  graceEndDate: string | null;
  finalDueDate: string | null;
  lateFeePct: number;
  description: string;
  channels: string;
}

function fmtPreviewDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtMoney(n: number) {
  return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

function getDailyRate(lateFeePct: number, graceEnd: string | null, finalDue: string | null) {
  if (!graceEnd || !finalDue || lateFeePct <= 0) return 0;
  const days = Math.ceil(
    (new Date(finalDue + "T00:00:00").getTime() - new Date(graceEnd + "T00:00:00").getTime()) / 86400000
  );
  return days > 0 ? lateFeePct / days : 0;
}

function EmailPreview({ businessName, amount, dueDate, graceEndDate, finalDueDate, lateFeePct, description }: Omit<SendPreviewProps, "channels">) {
  const dailyRate = getDailyRate(lateFeePct, graceEndDate, finalDueDate);
  const graceDays = graceEndDate
    ? Math.max(0, Math.round((new Date(graceEndDate + "T00:00:00").getTime() - new Date(dueDate + "T00:00:00").getTime()) / 86400000))
    : 0;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden text-xs shadow-sm">
      <div className="bg-primary px-4 py-3 text-white">
        <p className="font-bold text-sm">{businessName || "Your Business"}</p>
        <p className="opacity-80 text-[11px]">Payment Request</p>
      </div>
      <div className="px-4 py-3 space-y-2.5 text-slate-700">
        <p className="text-[12px]">Hi <span className="font-semibold">Client</span> 👋</p>

        {/* Prose intro */}
        <p className="text-[12px] text-slate-800 leading-relaxed">
          <span className="font-bold">{businessName || "Your Business"}</span> sent you a payment request
          {description && <> for <em>{description}</em></>} of{" "}
          <span className="font-bold text-primary">{fmtMoney(amount)}</span> and is due{" "}
          <span className="font-semibold">{fmtPreviewDate(dueDate)}</span>.
          {lateFeePct > 0 && (
            <> Miss it → a{" "}
              <strong className="text-amber-700">
                {dailyRate > 0 ? `${dailyRate.toFixed(1)}%/day` : `${lateFeePct}%`} fee
              </strong>{" "}
              applies automatically.
            </>
          )}
        </p>
        {!description && (
          <p className="text-[10px] text-slate-400 italic">
            ↑ Fill in &quot;What is this payment for?&quot; and it will appear above
          </p>
        )}

        {/* Grace gift */}
        {graceDays > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[11px] text-green-800">
            🎁 You have <strong>{graceDays} free grace days</strong> — claim them now and pay <strong>{fmtMoney(amount)}</strong>, nothing added.
          </div>
        )}

        {/* Single CTA */}
        <div className={`text-white text-center rounded-lg py-2.5 text-[11px] font-bold ${graceDays > 0 ? "bg-green-600" : "bg-primary"}`}>
          📅 {graceDays > 0 ? "Claim your free days →" : "Pick your payment date →"}
        </div>
      </div>
      <div className="px-4 py-2 border-t border-slate-100 text-center text-[10px] text-slate-400">
        Powered by Trailbill
      </div>
    </div>
  );
}

function WhatsAppPreview({ businessName, amount, dueDate, graceEndDate, finalDueDate, lateFeePct, description }: Omit<SendPreviewProps, "channels">) {
  const dailyRate = getDailyRate(lateFeePct, graceEndDate, finalDueDate);
  const hasGrace = !!graceEndDate;
  const hasLateFee = lateFeePct > 0;
  const biz = businessName || "Your Business";

  return (
    <div className="bg-[#e5ddd5] rounded-xl overflow-hidden shadow-sm border border-border">
      <div className="bg-[#075e54] px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
          {biz.charAt(0)}
        </div>
        <span className="text-white text-xs font-medium">{biz}</span>
      </div>
      <div className="px-3 py-3">
        <div className="bg-white rounded-lg rounded-tl-none shadow-sm max-w-[90%] overflow-hidden">
          <div className="px-3 py-2 space-y-1 text-[11px] text-slate-800 leading-relaxed">
            <p>Hi Client, you have a new payment request from <span className="font-bold">{biz}</span>.</p>
            <p>💰 Amount due: <span className="font-medium">{fmtMoney(amount)}</span></p>
            <p>📋 Reference: TB-2026-001</p>
            <p>📅 Due date: <span className="font-medium">{fmtPreviewDate(dueDate)}</span></p>
            {description && <p>📝 For: {description}</p>}
            {hasGrace && (
              <p>✅ Grace period until: <span className="font-medium">{fmtPreviewDate(graceEndDate)}</span></p>
            )}
            {hasLateFee && hasGrace && (
              <p>
                ⚠️ Late fee: <span className="font-medium">{dailyRate.toFixed(2)}%/day</span> from {fmtPreviewDate(graceEndDate)}
                {finalDueDate && <> (max {lateFeePct}% by {fmtPreviewDate(finalDueDate)})</>}
              </p>
            )}
            <p className="text-[10px] text-slate-400 italic pt-1">Powered by Trailbill</p>
          </div>
          <div className="border-t border-slate-100 px-3 py-1.5 text-center">
            <span className="text-[11px] text-[#075e54] font-medium">📅 When will you pay?</span>
          </div>
          <div className="border-t border-slate-100 px-3 py-1.5 text-center">
            <span className="text-[11px] text-[#075e54] font-medium">🕐 Ask for extra days</span>
          </div>
          <div className="px-3 pb-1 text-right">
            <span className="text-[10px] text-slate-400">7:42 PM ✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmsPreview({ businessName, amount, dueDate, description }: Omit<SendPreviewProps, "channels">) {
  const smsText = `[${businessName || "Your Business"}] Hi Client, payment of ${fmtMoney(amount)} due ${fmtPreviewDate(dueDate)}${description ? ` for: ${description}` : ""}. View: trailbill.com/pay/abc123`;
  return (
    <div className="bg-slate-100 rounded-xl overflow-hidden shadow-sm border border-border">
      {/* SMS header */}
      <div className="bg-slate-800 px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-[10px] font-bold">
          {(businessName || "B").charAt(0)}
        </div>
        <div>
          <p className="text-white text-xs font-medium">{businessName || "Your Business"}</p>
          <p className="text-slate-400 text-[10px]">SMS</p>
        </div>
      </div>
      <div className="px-3 py-3">
        <div className="bg-white rounded-lg rounded-tl-none shadow-sm px-3 py-2 max-w-[90%]">
          <p className="text-[11px] text-slate-800 leading-relaxed">{smsText}</p>
          <p className="text-[10px] text-slate-400 mt-1 text-right">Now</p>
        </div>
      </div>
    </div>
  );
}

export function SendPreview(props: SendPreviewProps) {
  const { channels } = props;
  const showEmail    = ["email", "both", "email+sms", "all"].includes(channels);
  const showWhatsApp = ["whatsapp", "both", "whatsapp+sms", "all"].includes(channels);
  const showSMS      = ["sms", "email+sms", "whatsapp+sms", "all"].includes(channels);

  const defaultTab = showEmail ? "email" : showWhatsApp ? "whatsapp" : "sms";
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="sticky top-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Live Preview</h3>
        <p className="text-xs text-muted-foreground">Updates as you fill in the form</p>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-muted/30 rounded-lg p-1">
        {([
          { id: "email",    label: "Email",     visible: showEmail },
          { id: "whatsapp", label: "WhatsApp",  visible: showWhatsApp },
          { id: "sms",      label: "SMS",       visible: showSMS },
        ] as const).filter(t => t.visible).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Preview content */}
      {activeTab === "email" && <EmailPreview {...props} />}
      {activeTab === "whatsapp" && <WhatsAppPreview {...props} />}
      {activeTab === "sms" && <SmsPreview {...props} />}
      {/* Channel indicator */}
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        {[showEmail && "Email", showWhatsApp && "WhatsApp", showSMS && "SMS"].filter(Boolean).join(" + ")} will be sent
      </p>
    </div>
  );
}
