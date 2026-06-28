import { createClient } from "@/lib/supabase/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { InstitutCompliancePanel } from "@/components/compliance/institut-compliance-panel";
import { parseTenantCompliance } from "@/lib/compliance/tenant-compliance";

export default async function CompteInstitutConformitePage() {
  const session = await requireInstitutSettingsModule();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, compliance, data_retention_days")
    .eq("id", session.tenant.id)
    .single();

  const checklist = parseTenantCompliance(tenant?.compliance);

  return (
    <InstitutCompliancePanel
      checklist={checklist}
      retentionDays={tenant?.data_retention_days ?? null}
      tenantName={tenant?.name ?? session.tenant.name}
    />
  );
}
