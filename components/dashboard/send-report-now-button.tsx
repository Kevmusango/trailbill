"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function SendReportNowButton({ type }: { type: string }) {
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch("/api/reports/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send report");
      } else {
        toast.success(`Report sent to ${data.sentTo}`);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
      title="Send this report to your email now"
    >
      <Send className="w-3 h-3" />
      {loading ? "Sending…" : "Send now"}
    </button>
  );
}
