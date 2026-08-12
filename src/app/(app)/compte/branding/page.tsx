import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBranding } from "@/lib/institut/tenant-branding";
import { Card } from "@/components/ui/card";
import { InstitutBrandingForm } from "@/app/(app)/institut/marketing/branding/branding-form";

export default async function CompteBrandingPage() {
  const session = await requireInstitutSettingsModule();
  const t = await getTranslations("account.branding");
  const supabase = await createClient();
  const branding = await fetchTenantBranding(
    supabase,
    session.tenant.id,
    session.tenant.name,
  );

  return (
    <Card className="w-full space-y-5 p-5 shadow-none sm:p-6 lg:p-8">
      <div>
        <h2 className="font-medium text-slate-900">{t("sectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("sectionDescription")}</p>
      </div>
      <InstitutBrandingForm
        branding={branding}
        instituteName={session.tenant.name}
      />
    </Card>
  );
}
