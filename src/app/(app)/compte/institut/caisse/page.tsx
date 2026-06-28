import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { SettingsSection } from "../settings-section";
import { PosSettingsForm } from "./pos-settings-form";

export default async function CompteInstitutCaissePage() {
  const t = await getTranslations("institut.posSettings");
  const session = await requireInstitutSettingsModule();
  const supabase = await createClient();
  const settings = await getPosSettings(supabase, session.tenant.id);

  return (
    <SettingsSection
      title={t("title")}
      description={t("description")}
      status={t("configured")}
      statusTone="success"
    >
      <PosSettingsForm settings={settings} />
    </SettingsSection>
  );
}
