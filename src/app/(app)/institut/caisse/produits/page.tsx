import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "./products-manager";

export default async function CaisseProduitsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("inst_products")
    .select("id, name, sku, price_cents, stock_quantity, created_at")
    .eq("tenant_id", session.tenant.id)
    .eq("source", "internal")
    .order("name");

  return <ProductsManager products={products ?? []} />;
}
