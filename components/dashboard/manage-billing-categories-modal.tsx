"use client";

import { useState, useEffect } from "react";
import { Tag, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ManageBillingCategoriesModal({
  businessId,
  initialCategories,
}: {
  businessId: string;
  initialCategories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [newCategory, setNewCategory] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!open || !businessId) return;
    const supabase = createClient();
    supabase.from("businesses").select("billing_categories").eq("id", businessId).single()
      .then(({ data }) => { if (data?.billing_categories) setCategories(data.billing_categories); });
  }, [open, businessId]);

  const addCategory = () => {
    const v = newCategory.trim();
    if (!v || categories.includes(v)) return;
    setCategories(p => [...p, v]);
    setNewCategory("");
  };

  const handleSave = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ billing_categories: categories })
      .eq("id", businessId);

    if (error) {
      console.error("Billing categories save error:", error);
      toast.error(`Failed to save: ${error.message}`);
      setLoading(false);
      return;
    }

    toast.success("Billing categories saved");
    setOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tag className="w-4 h-4" />
          Billing Categories
          {categories.length > 0 && (
            <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {categories.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Billing Categories</DialogTitle>
          <DialogDescription>
            Define what you bill for. These appear as a dropdown on every payment request — for groups and individuals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
              placeholder="e.g. Rent, Parking, Maintenance, Levy..."
              className="h-9"
            />
            <Button type="button" variant="outline" size="sm" className="h-9 px-3 shrink-0" onClick={addCategory}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {categories.map(cat => (
                <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {cat}
                  <button type="button" onClick={() => setCategories(p => p.filter(c => c !== cat))} className="hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed border-border">
              No categories yet — add your first one above
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
