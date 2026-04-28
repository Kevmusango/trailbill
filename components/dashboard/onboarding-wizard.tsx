"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Landmark, FolderPlus, Briefcase, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SA_PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
  "Limpopo", "Mpumalanga", "North West", "Free State", "Northern Cape",
];

const selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const INDUSTRIES = [
  { value: "school",     emoji: "🏫", label: "School / Tuition" },
  { value: "daycare",    emoji: "🧒", label: "Daycare / Crèche" },
  { value: "studio",     emoji: "🎵", label: "Music / Dance / Art" },
  { value: "hoa",        emoji: "🏢", label: "Body Corporate / HOA" },
  { value: "property",   emoji: "🏠", label: "Property Management" },
  { value: "storage",    emoji: "📦", label: "Storage Facility" },
  { value: "gym",        emoji: "💪", label: "Gym / Fitness" },
  { value: "medical",    emoji: "🏥", label: "Medical / Dental" },
  { value: "security",   emoji: "🔒", label: "Security / Guarding" },
  { value: "cleaning",   emoji: "🧹", label: "Cleaning Service" },
  { value: "garden",     emoji: "🌿", label: "Garden / Maintenance" },
  { value: "it",         emoji: "💻", label: "IT / Tech Support" },
  { value: "stokvel",    emoji: "🤝", label: "Stokvel / Savings Group" },
  { value: "insurance",  emoji: "🛡️", label: "Insurance" },
  { value: "other",      emoji: "✏️", label: "Other" },
];

interface OnboardingWizardProps {
  businessId: string;
  businessName: string;
}

export function OnboardingWizard({ businessId, businessName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0: Business details
  const [name, setName] = useState(businessName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  // Step 1: Industry
  const [industry, setIndustry] = useState("");
  const [otherIndustry, setOtherIndustry] = useState("");

  // Step 2: Banking
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountType, setAccountType] = useState("cheque");

  // Step 3: First group
  const [groupName, setGroupName] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [graceDays, setGraceDays] = useState("0");
  const [activeMonths, setActiveMonths] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12]);

  const toggleMonth = (month: number) => {
    setActiveMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a,b) => a-b)
    );
  };

  const steps = [
    { icon: Building2, title: "Your Business",   subtitle: "Tell us a little about yourself" },
    { icon: Briefcase,  title: "Your Industry",   subtitle: "Required — what kind of business do you run?" },
    { icon: Landmark,   title: "Banking Details", subtitle: "Where your clients will pay you" },
    { icon: FolderPlus, title: "First Group",     subtitle: "Set up your first billing group" },
  ];

  const resolvedIndustry = industry === "other" ? otherIndustry.trim() : industry;

  const canNext = () => {
    if (step === 0) return name.trim().length > 0 && province.length > 0 && city.trim().length > 0;
    if (step === 1) return resolvedIndustry.length > 0 && (industry !== "other" || otherIndustry.trim().length > 0);
    if (step === 2) return true;
    if (step === 3) return groupName.trim().length > 0 && Number(defaultAmount) > 0 && activeMonths.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setLoading(true);
    const supabase = createClient();

    const { error: bizError } = await supabase.from("businesses").update({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      industry: resolvedIndustry || null,
      province: province || null,
      city: city.trim() || null,
      bank_name: bankName.trim() || null,
      account_number: accountNumber.trim() || null,
      branch_code: branchCode.trim() || null,
      account_type: accountType,
      onboarding_completed: true,
    }).eq("id", businessId);

    if (bizError) {
      toast.error("Failed to save business details");
      setLoading(false);
      return;
    }

    if (groupName.trim() && Number(defaultAmount) > 0) {
      const { error: groupError } = await supabase.from("client_groups").insert({
        business_id: businessId,
        name: groupName.trim(),
        default_amount: Number(defaultAmount),
        due_day: Number(dueDay),
        grace_days: Number(graceDays),
        active_months: activeMonths,
      });
      if (groupError) toast.error("Failed to create group, but business details saved");
    }

    toast.success("Welcome to TrailBill! You're all set.");
    router.push("/dashboard");
    setLoading(false);
  };

  return (
    <div className="w-full max-w-lg">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < step  ? "bg-primary/20 text-primary" :
              i === step ? "bg-primary text-white" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 transition-colors ${i < step ? "bg-primary/40" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        {/* Header */}
        <div className="text-center mb-5">
          {(() => {
            const Icon = steps[step].icon;
            return (
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Icon className="w-6 h-6 text-primary" />
              </div>
            );
          })()}
          <h2 className="text-xl font-bold">{steps[step].title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{steps[step].subtitle}</p>
        </div>

        {/* Step 0: Business Details */}
        {step === 0 && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Business Name <span className="text-destructive">*</span></label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunshine Crèche" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Phone</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="072 123 4567" type="tel" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="info@business.co.za" type="email" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Province <span className="text-destructive">*</span></label>
              <select value={province} onChange={e => setProvince(e.target.value)} className={selectClass}>
                <option value="">Select province…</option>
                {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">City <span className="text-destructive">*</span></label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Johannesburg" />
            </div>
          </div>
        )}

        {/* Step 1: Industry */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Tap the one that best describes your business
            </p>
            <div className="grid grid-cols-3 gap-2">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind.value}
                  type="button"
                  onClick={() => setIndustry(ind.value)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-center transition-all ${
                    industry === ind.value
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="text-2xl leading-none">{ind.emoji}</span>
                  <span className="text-[11px] font-medium leading-tight">{ind.label}</span>
                </button>
              ))}
            </div>
            {industry === "other" && (
              <Input
                value={otherIndustry}
                onChange={e => setOtherIndustry(e.target.value)}
                placeholder="Describe your business…"
                autoFocus
                className="mt-1"
              />
            )}
          </div>
        )}

        {/* Step 2: Banking */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5 text-center">
              This is shown on client payment pages so they know where to pay. You can update it later.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Bank</label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="FNB" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Account No.</label>
                <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="62000000000" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Branch Code</label>
                <Input value={branchCode} onChange={e => setBranchCode(e.target.value)} placeholder="250655" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Account Type</label>
              <div className="grid grid-cols-3 gap-2">
                {["cheque", "savings", "transmission"].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccountType(t)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] border capitalize ${
                      accountType === t
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: First Group */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-sm font-medium mb-1 block">Group Name <span className="text-destructive">*</span></label>
                <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Grade 1 – 2025" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Monthly Amount <span className="text-destructive">*</span></label>
                <Input value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} placeholder="2500" type="number" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Day</label>
                <Input value={dueDay} onChange={e => setDueDay(e.target.value)} type="number" min="1" max="28" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Grace Period <span className="text-xs font-normal text-muted-foreground">(extra days before late fee kicks in)</span></label>
              <Input value={graceDays} onChange={e => setGraceDays(e.target.value)} type="number" min="0" placeholder="0" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Billing Months <span className="text-xs font-normal text-muted-foreground">(which months do you charge?)</span></label>
              <div className="grid grid-cols-6 gap-1.5">
                {MONTHS.map((m, i) => {
                  const monthNum = i + 1;
                  const isActive = activeMonths.includes(monthNum);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(monthNum)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] border ${
                        isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/30 border-border text-muted-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-border">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : <div />}

          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="gap-2">
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading || !canNext()} className="gap-2">
              {loading ? "Setting up…" : "Finish Setup"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
