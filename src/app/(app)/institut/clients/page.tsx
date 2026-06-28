import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, email, phone, created_at")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" />
      <ClientsManager clients={clients ?? []} />
    </div>
  );
}
