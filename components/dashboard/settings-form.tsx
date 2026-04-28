"use client";

import { useState, useRef } from "react";
import { Save, Upload, X, ImageIcon, Mail, MessageCircle, Smartphone, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Business } from "@/lib/types";
import { normalizeLogoUrl } from "@/lib/utils";

const SA_PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
  "Limpopo", "Mpumalanga", "North West", "Free State", "Northern Cape",
];

const INDUSTRIES = [
  "Education", "Healthcare", "Fitness & Wellness", "Retail",
  "Professional Services", "Transport & Logistics", "Construction",
  "Non-Profit", "Hospitality", "Financial Services",
  "Agriculture", "Technology", "Other",
];

const selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function SettingsForm({ business }: { business: Business | null }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [name, setName] = useState(business?.name ?? "");
  const [phone, setPhone] = useState(business?.phone ?? "");
  const [email, setEmail] = useState(business?.email ?? "");
  const [smsNumber, setSmsNumber] = useState(business?.sms_number ?? "");

  const [emailNotif, setEmailNotif] = useState(business?.email_notifications ?? true);
  const [whatsappNotif, setWhatsappNotif] = useState(business?.whatsapp_notifications ?? true);
  const [smsNotif, setSmsNotif] = useState(business?.sms_notifications ?? false);

  const knownIndustries = INDUSTRIES.filter(i => i !== "Other");
  const rawIndustry = business?.industry ?? "";
  const isOtherIndustry = rawIndustry !== "" && !knownIndustries.includes(rawIndustry);
  const [industry, setIndustry] = useState(isOtherIndustry ? "Other" : rawIndustry);
  const [otherIndustry, setOtherIndustry] = useState(isOtherIndustry ? rawIndustry : "");
  const [province, setProvince] = useState(business?.province ?? "");
  const [city, setCity] = useState(business?.city ?? "");

  const [bankName, setBankName] = useState(business?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(business?.account_number ?? "");
  const [branchCode, setBranchCode] = useState(business?.branch_code ?? "");
  const knownTypes = ["cheque", "savings", "transmission", "business", "credit", "other"];
  const rawType = business?.account_type ?? "cheque";
  const isOther = rawType !== null && !knownTypes.includes(rawType);
  const [accountType, setAccountType] = useState(isOther ? "other" : rawType);
  const [otherAccountType, setOtherAccountType] = useState(isOther ? rawType : "");

  const [logoUrl, setLogoUrl] = useState<string | null>(normalizeLogoUrl(business?.logo_url));
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    if (!business?.id) return;
    if (file.size > 1048576) { toast.error("Logo must be under 1 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) { toast.error("Only PNG, JPG, WebP or SVG allowed"); return; }
    setLogoUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop();
    const path = `${user?.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error("Logo upload failed"); setLogoUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("business-logos").getPublicUrl(path);
    const cacheBusted = `${publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase.from("businesses")
      .update({ logo_url: cacheBusted }).eq("id", business.id);
    if (updateError) { toast.error("Failed to save logo"); } else {
      setLogoUrl(cacheBusted);
      toast.success("Logo saved");
    }
    setLogoUploading(false);
  };

  const handleLogoRemove = async () => {
    if (!business?.id) return;
    const supabase = createClient();
    await supabase.from("businesses").update({ logo_url: null }).eq("id", business.id);
    setLogoUrl(null);
    toast.success("Logo removed");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedIndustry = industry === "Other" ? otherIndustry.trim() : industry;
    if (!name.trim()) { toast.error("Business name is required"); return; }
    if (!phone.trim() && !email.trim() && !smsNumber.trim()) {
      toast.error("Add at least one notification channel — Email, WhatsApp, or SMS");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("businesses").update({
      logo_url:       logoUrl,
      name:           name.trim(),
      phone:          phone.trim() || null,
      email:          email.trim() || null,
      sms_number:     smsNumber.trim() || null,
      email_notifications:    emailNotif,
      whatsapp_notifications: whatsappNotif,
      sms_notifications:      smsNotif,
      industry:       resolvedIndustry || null,
      province:       province || null,
      city:           city.trim() || null,
      bank_name:      bankName.trim() || null,
      account_number: accountNumber.trim() || null,
      branch_code:    branchCode.trim() || null,
      account_type:   accountType === "other" ? (otherAccountType.trim() || "other") : accountType,
    }).eq("id", business?.id ?? "");

    if (error) {
      toast.error("Failed to save settings");
      setLoading(false);
      return;
    }

    toast.success("Settings saved");
    setLoading(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* Logo */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold mb-1">Business Logo</h3>
        <p className="text-xs text-muted-foreground mb-4">Appears on emails and payment pages sent to your clients</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {logoUploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleLogoRemove}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
            <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP or SVG · max 1 MB</p>
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold mb-4">Business Information</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Business Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold mb-1">Notification Channels</h3>
        <p className="text-xs text-muted-foreground mb-4">
          When a client responds to a proposal, you&apos;ll be notified via these. <strong>At least one required.</strong>
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">WhatsApp Number</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="e.g. 072 123 4567" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="e.g. you@email.co.za" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              SMS Number <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input value={smsNumber} onChange={e => setSmsNumber(e.target.value)} type="tel" placeholder="e.g. 072 123 4567" />
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-sm font-medium mb-2">Active channels</p>
            <p className="text-xs text-muted-foreground mb-3">Choose which channels to use when sending proposals and notifications.</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={emailNotif} onChange={e => setEmailNotif(e.target.checked)} className="rounded border-border" />
                <span className="text-sm flex items-center gap-1.5"><Mail className="w-4 h-4 text-blue-500" /> Email</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary ml-auto">1 credit</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={whatsappNotif} onChange={e => setWhatsappNotif(e.target.checked)} className="rounded border-border" />
                <span className="text-sm flex items-center gap-1.5"><MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 ml-auto">2 credits</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={smsNotif} onChange={e => setSmsNotif(e.target.checked)} className="rounded border-border" />
                <span className="text-sm flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-blue-600" /> SMS</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 ml-auto">2 credits</span>
              </label>
              {!emailNotif && !whatsappNotif && !smsNotif && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Enable at least one channel</p>
              )}
            </div>
          </div>
          {!phone.trim() && !email.trim() && !smsNumber.trim() && (
            <p className="text-xs text-red-500 font-medium">⚠ Add at least one channel so you can receive proposal replies</p>
          )}
        </div>
      </div>

      {/* Location & Industry */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold mb-4">Location &amp; Industry</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Industry</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)} className={selectClass}>
              <option value="">Select your industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            {industry === "Other" && (
              <Input value={otherIndustry} onChange={e => setOtherIndustry(e.target.value)} placeholder="Describe your industry…" className="mt-2" autoFocus />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Province</label>
              <select value={province} onChange={e => setProvince(e.target.value)} className={selectClass}>
                <option value="">Select province…</option>
                {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">City</label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Johannesburg" />
            </div>
          </div>
        </div>
      </div>

      {/* Banking */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold mb-1">Banking Details</h3>
        <p className="text-xs text-muted-foreground mb-4">Shown on client payment pages</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Bank Name</label>
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. FNB" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Account Number</label>
              <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="62000000000" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Branch Code</label>
              <Input value={branchCode} onChange={e => setBranchCode(e.target.value)} placeholder="250655" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {["cheque", "savings", "transmission", "business", "credit", "other"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccountType(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] border capitalize ${
                    accountType === t
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/30 border-border text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {accountType === "other" && (
              <Input
                value={otherAccountType}
                onChange={e => setOtherAccountType(e.target.value)}
                placeholder="Specify account type…"
                className="mt-2"
                autoFocus
              />
            )}
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="gap-2">
        <Save className="w-4 h-4" />
        {loading ? "Saving..." : "Save Settings"}
      </Button>

      <DeleteAccountSection businessName={business?.name ?? ""} />
    </form>
  );
}

function DeleteAccountSection({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const nameMatch = typedName.trim().toLowerCase() === businessName.trim().toLowerCase();
  const canDelete = nameMatch && password.length >= 6;

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, businessName: typedName }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete account");
        setLoading(false);
        return;
      }
      toast.success("Account deleted");
      router.push("/login");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border-2 border-destructive/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trash2 className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Permanently delete your account and all associated data.
          </p>
        </div>
      </div>

      {!open ? (
        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Trash2 className="w-3.5 h-3.5" />
          Delete Account
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1 text-sm">
            <p className="font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> This action cannot be undone
            </p>
            <ul className="text-muted-foreground text-xs space-y-0.5 ml-5 list-disc">
              <li>Your business, clients, proposals and payment data will be permanently erased</li>
              <li>Your login credentials will be deleted</li>
              <li>You will not be able to recover any information</li>
            </ul>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Type your business name to confirm: <span className="text-destructive font-bold">{businessName}</span>
            </label>
            <Input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder={businessName}
              className={typedName && !nameMatch ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {typedName && !nameMatch && (
              <p className="text-xs text-destructive mt-1">Name does not match</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Enter your password</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your account password"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setTypedName(""); setPassword(""); }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || loading}
              className="gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {loading ? "Deleting…" : "Permanently Delete Account"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
