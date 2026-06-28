import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchClientOverview } from "@/lib/institut/clients";
import { canManageInstitutSettings } from "@/lib/auth/institut-settings";
import { isAnonymizedClientEmail } from "@/lib/compliance/anonymize";
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

  const { provisionClientAccess, upgradeLegacyClientLoginId } = await import(
    "@/lib/institut/client-access"
  );

  if (overview.client.login_id && /^\d{4,8}$/.test(overview.client.login_id)) {
    await upgradeLegacyClientLoginId(supabase, session.tenant.id, id);
    overview = (await fetchClientOverview(supabase, session.tenant.id, id)) ?? overview;
  }

  if (!overview.client.login_id || !overview.client.pin_code) {
    await provisionClientAccess(supabase, session.tenant.id, id);
    overview = (await fetchClientOverview(supabase, session.tenant.id, id)) ?? overview;
  }

  return (
    <ClientDetail
      overview={overview}
      canAnonymize={canManageInstitutSettings(session.role, session.enabledModuleIds)}
      isAnonymized={isAnonymizedClientEmail(overview.client.email)}
    />
  );
}
