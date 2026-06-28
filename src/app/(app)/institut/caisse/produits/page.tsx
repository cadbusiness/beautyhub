import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Produits internes"
          description="Articles vendus a la caisse sans passer par WooCommerce."
        />
        <Link href="/institut/caisse">
          <Button variant="outline" type="button" className="h-9">
            Retour caisse
          </Button>
        </Link>
      </div>

      <ProductsManager products={products ?? []} />
    </div>
  );
}
