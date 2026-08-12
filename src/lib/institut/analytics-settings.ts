import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type AnalyticsSettings = {
  tenant_id: string;
  include_woo_sales: boolean;
};

export const DEFAULT_ANALYTICS_SETTINGS: Omit<AnalyticsSettings, "tenant_id"> = {
  include_woo_sales: true,
};

export async function getAnalyticsSettings(
  supabase: Db,
  tenantId: string,
): Promise<AnalyticsSettings> {
  const { data } = await supabase
    .from("inst_analytics_settings")
    .select("include_woo_sales")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return {
    tenant_id: tenantId,
    include_woo_sales: data?.include_woo_sales ?? DEFAULT_ANALYTICS_SETTINGS.include_woo_sales,
  };
}

export async function saveAnalyticsSettings(
  supabase: Db,
  tenantId: string,
  input: Pick<AnalyticsSettings, "include_woo_sales">,
): Promise<void> {
  const { error } = await supabase.from("inst_analytics_settings").upsert(
    {
      tenant_id: tenantId,
      include_woo_sales: input.include_woo_sales,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(error.message);
}
