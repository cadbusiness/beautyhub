import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getTenantConnectionStatus } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PosTerminal } from "./pos-terminal";
import { syncWooProducts } from "../woo-actions";

export default async function CaissePage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [woo, productsRes, clientsRes] = await Promise.all([
    getTenantConnectionStatus(tenantId, WOO_PROVIDER),
    supabase
      .from("inst_products")
      .select("id, name, price_cents, image_url, synced_at")
      .eq("tenant_id", tenantId)
      .eq("status", "publish")
      .order("name"),
    supabase
      .from("clients")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const connected = woo?.status === "connected";
  const products = productsRes.data ?? [];
  const clients = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Caisse
        </h1>
        {connected ? (
          <form action={syncWooProducts}>
            <Button variant="outline" type="submit">
              Synchroniser les produits
            </Button>
          </form>
        ) : null}
      </div>

      {!connected ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Connecte ta boutique WooCommerce pour vendre des produits a la caisse.
          </p>
          <Link href="/institut/parametres">
            <Button>Connecter WooCommerce</Button>
          </Link>
        </Card>
      ) : products.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Boutique connectee, mais aucun produit synchronise. Lance la synchronisation.
          </p>
          <form action={syncWooProducts}>
            <Button type="submit">Synchroniser les produits</Button>
          </form>
        </Card>
      ) : (
        <PosTerminal products={products} clients={clients} />
      )}
    </div>
  );
}
