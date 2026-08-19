import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { WooClient } from "./client";
import {
  backfillOrphanWooSaleItems,
  categoryTreeById,
  getWooConnectionForTenant,
  listWooConnectionsForTenant,
  mapWooProductToRow,
  upsertWooVariations,
} from "@/lib/woocommerce";

type Db = SupabaseClient<Database>;

export type WooShopConnection = {
  connectionId: string;
  shopUrl: string;
  client: WooClient;
};

/**
 * Charge les boutiques Woo du tenant.
 * Même ordre que l’import clients : client utilisateur (RLS) d’abord,
 * puis service role, puis la connexion unique.
 */
export async function loadWooShopsForTenant(
  tenantId: string,
  userSupabase?: Db,
): Promise<WooShopConnection[]> {
  if (userSupabase) {
    const fromUser = await listWooConnectionsForTenant(tenantId, userSupabase);
    if (fromUser.length > 0) return fromUser;
  }

  const fromService = await listWooConnectionsForTenant(tenantId);
  if (fromService.length > 0) return fromService;

  const single =
    (userSupabase
      ? await getWooConnectionForTenant(tenantId, undefined, userSupabase)
      : null) ?? (await getWooConnectionForTenant(tenantId));
  return single ? [single] : [];
}

export async function syncWooCatalogForTenant(
  tenantId: string,
  writeSupabase: Db,
  userSupabase?: Db,
): Promise<{ syncedCount: number; shopsCount: number }> {
  const connections = await loadWooShopsForTenant(tenantId, userSupabase);
  if (connections.length === 0) {
    console.error("[woo-sync] no shop", {
      tenantId,
      hasEncKey: Boolean(process.env.CONNECTIONS_ENCRYPTION_KEY?.trim()),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    });
    throw new Error("woo_no_shop");
  }

  let syncedCount = 0;

  for (const connection of connections) {
    const tree = categoryTreeById(
      await connection.client.listAllProductCategories(),
    );

    for (let page = 1; page <= 50; page++) {
      const products = await connection.client.listProducts(page, 50);
      if (products.length === 0) break;

      const rows = products.map((p) =>
        mapWooProductToRow(tenantId, connection.connectionId, p, tree),
      );

      const { error } = await writeSupabase
        .from("inst_products")
        .upsert(rows, { onConflict: "tenant_id,connection_id,woo_id" });
      if (error) throw new Error(error.message);
      syncedCount += rows.length;

      const variableProducts = products.filter(
        (p) =>
          p.type === "variable" &&
          Array.isArray(p.variations) &&
          p.variations.length > 0,
      );
      for (const parent of variableProducts) {
        try {
          const variations = await connection.client.listAllProductVariations(
            parent.id,
          );
          if (variations.length > 0) {
            syncedCount += await upsertWooVariations(
              writeSupabase,
              tenantId,
              connection.connectionId,
              parent,
              variations,
              tree,
            );
          }
        } catch (err) {
          console.error("[woo-sync] variations fetch failed", {
            productId: parent.id,
            message: (err as Error).message,
          });
        }
      }

      if (products.length < 50) break;
    }

    try {
      const linked = await backfillOrphanWooSaleItems(writeSupabase, tenantId, {
        fetchMissingFromWoo: true,
        connectionId: connection.connectionId,
      });
      if (linked > 0) {
        console.info("[woo-sync] backfill linked sale items", {
          tenantId,
          linked,
        });
      }
    } catch (err) {
      console.error("[woo-sync] backfill failed", {
        tenantId,
        message: (err as Error).message,
      });
    }
  }

  return { syncedCount, shopsCount: connections.length };
}
