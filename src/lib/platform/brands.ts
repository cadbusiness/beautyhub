import { createClient } from "@/lib/supabase/server";

export type BrandListRow = {
  id: string;
  name: string;
  slug: string;
  isPlatform: boolean;
  tenantCount: number;
  createdAt: string;
};

export async function fetchBrandListRows(): Promise<BrandListRow[]> {
  const supabase = await createClient();

  const [{ data: brands }, { data: tenants }] = await Promise.all([
    supabase.from("brands").select("id, name, slug, is_platform, created_at").order("name"),
    supabase.from("tenants").select("brand_id"),
  ]);

  const tenantCountByBrand = new Map<string, number>();
  for (const t of tenants ?? []) {
    tenantCountByBrand.set(t.brand_id, (tenantCountByBrand.get(t.brand_id) ?? 0) + 1);
  }

  return (brands ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    isPlatform: b.is_platform,
    tenantCount: tenantCountByBrand.get(b.id) ?? 0,
    createdAt: b.created_at,
  }));
}
