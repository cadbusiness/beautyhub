import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchPlatformSettingsPublic } from "@/lib/platform/settings";
import { ListPanel } from "@/components/ui/list-panel";
import { AssistantSettingsForm } from "./assistant-settings-form";

export default async function AdminSettingsPage() {
  await requirePlatformAdmin();
  const settings = await fetchPlatformSettingsPublic();

  return (
    <ListPanel className="min-h-0 flex-1">
      <AssistantSettingsForm settings={settings} />
    </ListPanel>
  );
}
