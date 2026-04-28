"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function GetStartedPage() {
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Your name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (!phone.trim()) { toast.error("Phone number is required"); return; }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("leads").insert({
      full_name: fullName.trim(),
      business_name: businessName.trim() || null,
      email: email.trim(),
      phone: phone.trim(),
    });

    if (error) {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="h-screen flex items-center justify-center px-4 bg-background overflow-hidden">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Application Received!</h1>
          <p className="text-muted-foreground mb-6">
            We&apos;ll review your details and set up your account. You&apos;ll receive your login
            credentials via email once approved.
          </p>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="px-4 pt-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="" className="h-9 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold">Get Started with TrailBill</h1>
          <p className="text-sm text-muted-foreground mt-1">Tell us about yourself and we&apos;ll set you up</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Your Name *</label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. John Doe" autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Business Name (optional)</label>
            <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. JD Transport" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email *</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Phone Number *</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="072 123 4567" />
          </div>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            <Send className="w-4 h-4" />
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log In
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}
