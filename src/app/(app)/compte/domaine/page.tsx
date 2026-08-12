import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantDomainSettings } from "@/lib/institut/tenant-domain";
import { Card } from "@/components/ui/card";
import { InstitutDomainForm } from "./domain-form";

export default async function CompteDomainePage() {
  const session = await requireInstitutSettingsModule();
  const t = await getTranslations("account.domain");
  const supabase = await createClient();
  const settings = await fetchTenantDomainSettings(
    supabase,
    session.tenant.id,
    session.tenant.slug,
  );

  return (
    <Card className="w-full space-y-5 p-5 shadow-none sm:p-6 lg:p-8">
      <div>
        <h2 className="font-medium text-slate-900">{t("sectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("sectionDescription")}</p>
      </div>
      <InstitutDomainForm settings={settings} />
    </Card>
  );
}
