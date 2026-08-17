import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { ProductsManager } from "./products-manager";

export default async function CaisseProduitsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const [{ data: products }, settings] = await Promise.all([
    supabase
      .from("inst_products")
      .select("id, name, sku, price_cents, stock_quantity, created_at")
      .eq("tenant_id", session.tenant.id)
      .eq("source", "internal")
      .order("name"),
    getPosSettings(supabase, session.tenant.id),
  ]);

  return <ProductsManager products={products ?? []} currency={settings.currency} />;
}
