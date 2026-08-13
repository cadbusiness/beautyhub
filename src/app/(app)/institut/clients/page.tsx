import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchClientsListPage } from "@/lib/institut/clients";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const initial = await fetchClientsListPage(supabase, session.tenant.id, {
    page: 1,
  });

  return <ClientsManager initial={initial} />;
}
