import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveConnection } from "@/lib/connections";
import { encryptCredentials } from "@/lib/connections/crypto";
import type { Database, Json } from "@/lib/db/database.types";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { WooClient, type WooCredentials } from "./client";
import { parseStoredWooCredentials } from "./credentials";

export const WOO_PROVIDER = "woocommerce";
export { parseStoredWooCredentials } from "./credentials";

/**
 * Construit un client WooCommerce pour un tenant en resolvant sa connexion
 * (cascade tenant -> brand -> plateforme). Retourne null si non connecte.
 */
export async function getWooClientForTenant(
  tenantId: string,
  supabaseOverride?: SupabaseClient<Database>,
): Promise<WooClient | null> {
  const direct = await getWooConnectionForTenant(
    tenantId,
    undefined,
    supabaseOverride,
  );
  if (direct) return direct.client;

  const conn = await resolveConnection(tenantId, WOO_PROVIDER);
  if (!conn || conn.status !== "connected" || !conn.credentials) return null;

  const creds = parseStoredWooCredentials(conn.credentials);
  if (!creds) return null;
  return new WooClient(creds);
}

export async function getWooConnectionForTenant(
  tenantId: string,
  shopUrl?: string,
  supabaseOverride?: SupabaseClient<Database>,
): Promise<{ connectionId: string; shopUrl: string; client: WooClient } | null> {
  const supabase = supabaseOverride ?? tryCreateServiceClient();
  if (!supabase) return null;

  let query = supabase
    .from("connections")
    .select("id, credentials, external_id")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", WOO_PROVIDER)
    .eq("status", "connected");

  if (shopUrl) {
    query = query.eq("external_id", shopUrl);
  } else {
    query = query.order("updated_at", { ascending: false }).limit(1);
  }

  const { data } = await query.maybeSingle();
  if (!data?.credentials || !data.id) return null;

  const creds = parseStoredWooCredentials(data.credentials);
  if (!creds) return null;

  return {
    connectionId: data.id,
    shopUrl: typeof data.external_id === "string" ? data.external_id : creds.url,
    client: new WooClient(creds),
  };
}

export async function listWooConnectionsForTenant(
  tenantId: string,
  supabaseOverride?: SupabaseClient<Database>,
): Promise<Array<{ connectionId: string; shopUrl: string; client: WooClient }>> {
  const supabase = supabaseOverride ?? tryCreateServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("connections")
    .select("id, credentials, external_id")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", WOO_PROVIDER)
    .eq("status", "connected")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[woo] list connections failed", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const out: Array<{ connectionId: string; shopUrl: string; client: WooClient }> = [];
  for (const row of data) {
    if (!row.credentials || !row.id) continue;
    const creds = parseStoredWooCredentials(row.credentials);
    if (!creds) {
      console.error("[woo] skip connection, credentials unreadable", row.id);
      continue;
    }
    out.push({
      connectionId: row.id,
      shopUrl: typeof row.external_id === "string" ? row.external_id : creds.url,
      client: new WooClient(creds),
    });
    void healWooCredentials(row.id, creds);
  }
  return out;
}

async function healWooCredentials(connectionId: string, creds: WooCredentials) {
  const db = tryCreateServiceClient();
  if (!db) return;
  try {
    await db
      .from("connections")
      .update({
        credentials: encryptCredentials({
          url: creds.url,
          consumerKey: creds.consumerKey,
          consumerSecret: creds.consumerSecret,
        }) as Json,
      })
      .eq("id", connectionId);
  } catch (error) {
    console.error("[woo] heal credentials failed", (error as Error).message);
  }
}

export {
  applyWooStockUpdate,
  backfillOrphanWooSaleItems,
  decrementLocalProductStock,
  decrementWooMirrorStock,
  generateWebhookCredentials,
  getWooCredentialsForTenant,
  mapWooProductToRow,
  mapWooVariationToRow,
  upsertWooProduct,
  upsertWooVariations,
  deactivateWooProduct,
  resolveWooWebhookConnection,
  verifyWebhookSignature,
  categoryTreeById,
} from "./sync";
export { WooClient };
export type {
  WooCredentials,
  WooCustomer,
  WooProduct,
  WooProductCategory,
  WooProductVariation,
} from "./client";
