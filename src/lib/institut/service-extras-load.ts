import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ServiceExtraConfig } from "@/lib/institut/service-extras";

type Db = SupabaseClient<Database>;

/** Charge le catalogue d'extras d'une prestation (sans embed PostgREST). */
export async function loadServiceExtrasCatalog(
  supabase: Db,
  tenantId: string,
  serviceId: string,
): Promise<ServiceExtraConfig[]> {
  const { data: links, error } = await supabase
    .from("inst_service_extras")
    .select("extra_service_id, min_qty, max_qty, sort_order")
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId)
    .order("sort_order");

  if (error || !links?.length) return [];

  const extraIds = [...new Set(links.map((l) => l.extra_service_id))];
  const { data: extras } = await supabase
    .from("inst_services")
    .select("id, name, description, duration_min, price_cents, image_url, is_active, visibility")
    .in("id", extraIds)
    .eq("is_active", true)
    .eq("visibility", "extra_only");

  const extraMap = new Map((extras ?? []).map((e) => [e.id, e]));

  return links
    .map((row) => {
      const extra = extraMap.get(row.extra_service_id);
      if (!extra) return null;
      return {
        extra_service_id: extra.id,
        name: extra.name,
        description: extra.description,
        duration_min: extra.duration_min,
        price_cents: extra.price_cents,
        image_url: extra.image_url,
        min_qty: row.min_qty,
        max_qty: row.max_qty,
        sort_order: row.sort_order,
      };
    })
    .filter((row): row is ServiceExtraConfig => row !== null);
}

/** Liens extra ↔ prestation pour l'édition admin. */
export async function loadServiceExtraLinks(
  supabase: Db,
  tenantId: string,
  serviceId: string,
): Promise<
  {
    extra_service_id: string;
    min_qty: number;
    max_qty: number;
    sort_order: number;
  }[]
> {
  const { data } = await supabase
    .from("inst_service_extras")
    .select("extra_service_id, min_qty, max_qty, sort_order")
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId)
    .order("sort_order");
  if (!data?.length) return [];

  const extraIds = [...new Set(data.map((row) => row.extra_service_id))];
  const { data: extraRows } = await supabase
    .from("inst_services")
    .select("id")
    .in("id", extraIds)
    .eq("tenant_id", tenantId)
    .eq("visibility", "extra_only");

  const allowed = new Set((extraRows ?? []).map((row) => row.id));
  return data.filter((row) => allowed.has(row.extra_service_id));
}
