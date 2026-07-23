import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { listPromos } from "@/lib/institut/promos-core";
import { PromosManager } from "../promos-manager";

export default async function MarketingPromosPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const promos = await listPromos(supabase, session.tenant.id);

  return <PromosManager promos={promos} />;
}
