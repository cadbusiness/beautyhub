import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchClientOverview } from "@/lib/institut/clients";
import { ClientDetail } from "./client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireModule("institut");
  const supabase = await createClient();
  let overview = await fetchClientOverview(supabase, session.tenant.id, id);

  if (!overview) notFound();

  if (!overview.client.login_id || !overview.client.pin_code) {
    const { provisionClientAccess } = await import("@/lib/institut/client-access");
    await provisionClientAccess(supabase, session.tenant.id, id);
    overview = (await fetchClientOverview(supabase, session.tenant.id, id)) ?? overview;
  }

  return <ClientDetail overview={overview} />;
}
