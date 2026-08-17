import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchClientOverview } from "@/lib/institut/clients";
import { loadClientLoyaltyCard } from "@/lib/institut/client-loyalty";
import { canManageInstitutSettings } from "@/lib/auth/institut-settings";
import { isAnonymizedClientEmail } from "@/lib/compliance/anonymize";
import { getWooCredentialsForTenant } from "@/lib/woocommerce";
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
  const loyalty = await loadClientLoyaltyCard(supabase, session.tenant.id, id);

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

  const { data: referrerRows } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .eq("tenant_id", session.tenant.id)
    .neq("id", id)
    .order("full_name");

  const referrerOptions = (referrerRows ?? []).map((c) => ({
    id: c.id,
    label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
  }));

  let wooShopUrl: string | null = null;
  const hasWooLink =
    overview.client.metadata &&
    typeof overview.client.metadata === "object" &&
    "woo_customer_id" in (overview.client.metadata as Record<string, unknown>);
  if (hasWooLink) {
    try {
      const creds = await getWooCredentialsForTenant(session.tenant.id);
      wooShopUrl = creds?.url ?? null;
    } catch {
      wooShopUrl = null;
    }
  }

  return (
    <ClientDetail
      overview={overview}
      canAnonymize={canManageInstitutSettings(session.role, session.enabledModuleIds)}
      isAnonymized={isAnonymizedClientEmail(overview.client.email)}
      referrerOptions={referrerOptions}
      wooShopUrl={wooShopUrl}
      loyalty={loyalty}
    />
  );
}
