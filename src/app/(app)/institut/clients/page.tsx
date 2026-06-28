import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchClientsWithSummary } from "@/lib/institut/clients";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const clients = await fetchClientsWithSummary(supabase, session.tenant.id);

  return <ClientsManager clients={clients} />;
}
