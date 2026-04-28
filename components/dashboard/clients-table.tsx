"use client";

import { useState, useMemo } from "react";
import { Trash2, Users, Search, X, Archive } from "lucide-react";
import { EditClientModal } from "@/components/dashboard/edit-client-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reference_number: string | null;
}

interface ClientsTableProps {
  clients: Client[];
  businessId: string;
}

export function ClientsTable({ clients, businessId }: ClientsTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [clients, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({ is_active: false })
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Failed to remove client");
    } else {
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      router.refresh();
    }
    setDeleting(false);
  };

  if (clients.length === 0 && search === "") {
    return (
      <div className="p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
        <p className="text-muted-foreground mb-6">Add your first client to start sending payment requests</p>
      </div>
    );
  }

  return (
    <>
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or phone…"
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-[11px] text-muted-foreground mt-1.5">{filtered.length} of {clients.length} clients</p>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No clients match <span className="font-medium">&ldquo;{search}&rdquo;</span>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Phone</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{client.name}</p>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{client.phone || "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{client.email || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-end gap-1.5">
                    <EditClientModal client={client} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(client)}
                      className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Remove client"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {filtered.map((client) => (
          <div key={client.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground">{client.phone || client.email || "No contact"}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <EditClientModal client={client} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteTarget(client)}
                className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title="Remove client"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="gap-3 max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <Archive className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Remove Client</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to remove <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
              {deleting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
