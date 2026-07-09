import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export interface ServiceExtraLinkInput {
  extra_service_id: string;
  min_qty: number;
  max_qty: number;
  sort_order: number;
}

type Db = SupabaseClient<Database>;

export async function persistServiceExtras(
  supabase: Db,
  tenantId: string,
  serviceId: string,
  links: ServiceExtraLinkInput[],
  extrasStepPosition: "before_time" | "after_time",
): Promise<string | null> {
  if (links.length > 0) {
    const extraIds = [...new Set(links.map((link) => link.extra_service_id))];
    const { data: extras, error: extrasError } = await supabase
      .from("inst_services")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("id", extraIds);
    if (extrasError) return extrasError.message;

    const allowed = new Set((extras ?? []).map((row) => row.id));
    const hasInvalid = extraIds.some((id) => !allowed.has(id));
    if (hasInvalid) return "invalid_extra_selection";
  }

  const { error: posError } = await supabase
    .from("inst_services")
    .update({ extras_step_position: extrasStepPosition })
    .eq("id", serviceId)
    .eq("tenant_id", tenantId);
  if (posError) return posError.message;

  await supabase
    .from("inst_service_extras")
    .delete()
    .eq("service_id", serviceId)
    .eq("tenant_id", tenantId);

  if (links.length > 0) {
    const { error } = await supabase.from("inst_service_extras").insert(
      links.map((l) => ({
        tenant_id: tenantId,
        service_id: serviceId,
        extra_service_id: l.extra_service_id,
        min_qty: l.min_qty,
        max_qty: l.max_qty,
        sort_order: l.sort_order,
      })),
    );
    if (error) return error.message;
  }
  return null;
}
