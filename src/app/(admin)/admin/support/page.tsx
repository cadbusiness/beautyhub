import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchSupportTickets } from "@/lib/platform/support";
import { PageHeader } from "@/components/ui/page-header";
import { SupportManager } from "./support-manager";

export default async function AdminSupportPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.support");
  const tickets = await fetchSupportTickets();

  return (
    <div className="space-y-6 py-6">
      <PageHeader title={t("title")} description={t("description")} />
      <SupportManager tickets={tickets} />
    </div>
  );
}
