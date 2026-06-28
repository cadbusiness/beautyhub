import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchModuleCatalogRows } from "@/lib/platform/modules";
import { ModulesManager } from "./modules-manager";

export default async function AdminModulesPage() {
  await requirePlatformAdmin();
  const modules = await fetchModuleCatalogRows();
  return <ModulesManager modules={modules} />;
}
