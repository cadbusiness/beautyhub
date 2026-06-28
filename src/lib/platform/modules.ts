import { createClient } from "@/lib/supabase/server";

export type ModuleCatalogRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  version: string;
  isActive: boolean;
  tenantCount: number;
};

export async function fetchModuleCatalogRows(): Promise<ModuleCatalogRow[]> {
  const supabase = await createClient();

  const [{ data: modules }, { data: tenantModules }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, name, description, category, version, is_active")
      .order("name"),
    supabase.from("tenant_modules").select("module_id, enabled"),
  ]);

  const tenantCountByModule = new Map<string, number>();
  for (const tm of tenantModules ?? []) {
    if (!tm.enabled) continue;
    tenantCountByModule.set(tm.module_id, (tenantCountByModule.get(tm.module_id) ?? 0) + 1);
  }

  return (modules ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    version: m.version,
    isActive: m.is_active,
    tenantCount: tenantCountByModule.get(m.id) ?? 0,
  }));
}

export async function fetchActiveModulesForSelect(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}
