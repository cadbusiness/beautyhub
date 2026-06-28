import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchPlatformSettingsPublic } from "@/lib/platform/settings";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantSettingsForm } from "./assistant-settings-form";

export default async function AdminSettingsPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.settings");
  const settings = await fetchPlatformSettingsPublic();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader title={t("title")} description={t("description")} />
      <AssistantSettingsForm settings={settings} />
    </div>
  );
}
