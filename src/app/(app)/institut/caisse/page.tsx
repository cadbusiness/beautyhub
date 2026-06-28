import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getTenantConnectionStatus } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { getStripeAccountForTenant } from "@/lib/stripe/index";
import { buildCatalog } from "@/lib/institut/pos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PosTerminal } from "./pos-terminal";
import { syncWooProducts } from "../woo-actions";

export default async function CaissePage() {
  const t = await getTranslations("institut.pos");
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [woo, stripeAccount, servicesRes, productsRes, clientsRes] = await Promise.all([
    getTenantConnectionStatus(tenantId, WOO_PROVIDER),
    getStripeAccountForTenant(tenantId),
    supabase
      .from("inst_services")
      .select("id, name, price_cents, color, duration_min")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inst_products")
      .select("id, name, price_cents, image_url, source, sku, status, woo_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "publish"])
      .order("name"),
    supabase
      .from("clients")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const connected = woo?.status === "connected";
  const catalog = buildCatalog(servicesRes.data ?? [], productsRes.data ?? []);
  const clients = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
  }));

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeEnabled = Boolean(stripeAccount && stripePublishableKey);

  return (
    <div className="space-y-4 px-4 py-4 lg:px-6">
      {connected ? (
        <div className="flex justify-end">
          <form action={syncWooProducts}>
            <Button variant="outline" type="submit" className="h-9">
              {t("syncWoo")}
            </Button>
          </form>
        </div>
      ) : null}

      {!connected && catalog.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-600">{t("emptyCatalog")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/institut/prestations">
              <Button variant="outline">{t("linkServices")}</Button>
            </Link>
            <Link href="/institut/caisse/produits">
              <Button variant="outline">{t("linkProducts")}</Button>
            </Link>
            <Link href="/institut/parametres">
              <Button>{t("linkSettings")}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {!connected ? (
            <p className="text-sm text-slate-500">
              {t("wooNotConnected")}{" "}
              <Link href="/institut/parametres" className="underline">
                {t("connectShop")}
              </Link>
            </p>
          ) : null}
          <PosTerminal
            catalog={catalog}
            clients={clients}
            stripeEnabled={stripeEnabled}
            stripePublishableKey={stripePublishableKey}
            stripeAccountId={stripeAccount?.accountId}
          />
        </>
      )}
    </div>
  );
}
