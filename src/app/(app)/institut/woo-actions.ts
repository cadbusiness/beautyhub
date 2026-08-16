"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { requireInstitutSettingsModule, COMPTE_INSTITUT_WOO } from "@/lib/auth/institut-settings";
import {
  disconnectTenantConnection,
  getTenantConnectionStatus,
  saveTenantConnection,
} from "@/lib/connections";
import { apiBaseUrl } from "@/lib/app-url";
import {
  buildPairingAdminUrl,
  createPairingToken,
  normalizeShopUrl,
} from "@/lib/connectors/pairing";
import {
  listWooConnectionsForTenant,
  WOO_PROVIDER,
  WooClient,
  backfillOrphanWooSaleItems,
  generateWebhookCredentials,
  mapWooProductToRow,
  upsertWooVariations,
} from "@/lib/woocommerce";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

export interface SyncWooResult {
  ok?: boolean;
  error?: string;
  syncedCount?: number;
  shopsCount?: number;
}

async function ensureWebhookConfig(
  tenantId: string,
  url: string,
): Promise<Record<string, unknown>> {
  const normalizedUrl = normalizeShopUrl(url);
  const existing = await getTenantConnectionStatus(tenantId, WOO_PROVIDER, normalizedUrl);
  const prev = existing?.config ?? {};

  if (
    typeof prev.webhook_token === "string" &&
    typeof prev.webhook_secret === "string"
  ) {
    return {
      url: normalizedUrl,
      webhook_token: prev.webhook_token,
      webhook_secret: prev.webhook_secret,
    };
  }

  const creds = generateWebhookCredentials();
  return {
    url: normalizedUrl,
    webhook_token: creds.webhookToken,
    webhook_secret: creds.webhookSecret,
  };
}

export interface PairingResult {
  error?: string;
  pairingUrl?: string;
  shopUrl?: string;
}

export async function startWooPairing(
  _prev: PairingResult,
  formData: FormData,
): Promise<PairingResult> {
  const t = await getTranslations("institut.woo.auto");
  const session = await requireInstitutSettingsModule();

  const shopUrl = String(formData.get("shop_url") ?? "").trim();
  if (!shopUrl) {
    return { error: t("shopRequired") };
  }

  let normalized: string;
  try {
    normalized = normalizeShopUrl(shopUrl);
    new URL(normalized);
  } catch {
    return { error: t("shopInvalid") };
  }

  const token = createPairingToken({
    tenantId: session.tenant.id,
    shopUrl: normalized,
    apiUrl: apiBaseUrl(),
  });

  return {
    pairingUrl: buildPairingAdminUrl(normalized, token, apiBaseUrl()),
    shopUrl: normalized,
  };
}

export async function saveWooConnection(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutSettingsModule();

  const url = String(formData.get("url") ?? "").trim();
  const consumerKey = String(formData.get("consumer_key") ?? "").trim();
  const consumerSecret = String(formData.get("consumer_secret") ?? "").trim();
  if (!url || !consumerKey || !consumerSecret) {
    return { error: t("urlKeySecretRequired") };
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeShopUrl(url);
  } catch {
    return { error: "URL WooCommerce invalide." };
  }

  try {
    const client = new WooClient({ url: normalizedUrl, consumerKey, consumerSecret });
    await client.testConnection();
  } catch (e) {
    return { error: t("connectionFailed", { message: (e as Error).message }) };
  }

  try {
    const config = await ensureWebhookConfig(session.tenant.id, normalizedUrl);
    await saveTenantConnection(
      session.tenant.id,
      WOO_PROVIDER,
      { url: normalizedUrl, consumerKey, consumerSecret },
      config,
      "connected",
      normalizedUrl,
    );
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath(COMPTE_INSTITUT_WOO);
  revalidatePath("/institut/caisse");
  return { ok: true, message: t("wooConnected") };
}

export async function disconnectWoo(): Promise<void> {
  const session = await requireInstitutSettingsModule();
  const status = await getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER);
  const externalId =
    typeof status?.config?.url === "string" ? normalizeShopUrl(status.config.url) : undefined;
  await disconnectTenantConnection(session.tenant.id, WOO_PROVIDER, externalId);
  revalidatePath(COMPTE_INSTITUT_WOO);
  revalidatePath("/institut/caisse");
}

export async function syncWooProducts(): Promise<void> {
  const session = await requireModule("institut");
  await syncWooProductsForTenant(session.tenant.id);
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/produits");
}

async function syncWooProductsForTenant(
  tenantId: string,
): Promise<{ syncedCount: number; shopsCount: number }> {
  const connections = await listWooConnectionsForTenant(tenantId);
  if (connections.length === 0) return { syncedCount: 0, shopsCount: 0 };

  const supabase = await createClient();
  let syncedCount = 0;

  for (const connection of connections) {
    // La boutique Woo peut avoir plus de 250 produits. On ne veut pas rater
    // des articles qui apparaitront ensuite sur des ventes → limite haute
    // (50 pages × 50 = 2500 produits) tout en gardant un garde-fou.
    for (let page = 1; page <= 50; page++) {
      const products = await connection.client.listProducts(page, 50);
      if (products.length === 0) break;

      const rows = products.map((p) =>
        mapWooProductToRow(tenantId, connection.connectionId, p),
      );

      await supabase
        .from("inst_products")
        .upsert(rows, { onConflict: "tenant_id,connection_id,woo_id" });
      syncedCount += rows.length;

      // Pour chaque produit `variable`, on materialise ses variations comme
      // rows separees dans inst_products : elles portent leur propre image,
      // sku, prix, stock, ce qui permet a la caisse mobile de matcher un
      // sale_item.product_id qui pointe vers une variation_id Woo.
      const variableProducts = products.filter(
        (p) => p.type === "variable" && Array.isArray(p.variations) && p.variations.length > 0,
      );
      for (const parent of variableProducts) {
        try {
          const variations = await connection.client.listAllProductVariations(
            parent.id,
          );
          if (variations.length > 0) {
            syncedCount += await upsertWooVariations(
              supabase,
              tenantId,
              connection.connectionId,
              parent,
              variations,
            );
          }
        } catch (err) {
          console.error(
            "[woo-sync] variations fetch failed",
            { productId: parent.id, message: (err as Error).message },
          );
        }
      }

      if (products.length < 50) break;
    }

    // Rattachement des sale_items historiques après resync : maintenant que
    // les variations sont en base, on peut lier les orphelins par woo_id.
    try {
      const linked = await backfillOrphanWooSaleItems(supabase, tenantId, {
        fetchMissingFromWoo: true,
        connectionId: connection.connectionId,
      });
      if (linked > 0) {
        console.info("[woo-sync] backfill linked sale items", { tenantId, linked });
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

export async function syncWooProductsAction(
  _prev: SyncWooResult,
): Promise<SyncWooResult> {
  void _prev;
  try {
    const session = await requireModule("institut");
    const result = await syncWooProductsForTenant(session.tenant.id);
    revalidatePath("/institut/caisse");
    revalidatePath("/institut/caisse/produits");
    return { ok: true, ...result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
