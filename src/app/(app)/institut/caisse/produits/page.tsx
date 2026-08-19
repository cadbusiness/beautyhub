import { requireInstitutAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { listProductCategories } from "@/lib/institut/internal-products";
import { ProductsManager } from "./products-manager";

export default async function CaisseProduitsPage() {
  const session = await requireInstitutAccess("pos", "read");
  const supabase = await createClient();
  const [{ data: products }, settings, categories] = await Promise.all([
    supabase
      .from("inst_products")
      .select("id, name, sku, price_cents, stock_quantity, category_id, created_at")
      .eq("tenant_id", session.tenant.id)
      .eq("source", "internal")
      .order("name"),
    getPosSettings(supabase, session.tenant.id),
    listProductCategories(supabase, session.tenant.id),
  ]);

  return (
    <ProductsManager
      products={products ?? []}
      categories={categories}
      currency={settings.currency}
    />
  );
}
