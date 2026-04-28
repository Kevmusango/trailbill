import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  // Keep subscription_active accurate on every admin page load too
  await supabase.rpc("expire_subscriptions");

  const userInitial = user.email?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader userInitial={userInitial} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
