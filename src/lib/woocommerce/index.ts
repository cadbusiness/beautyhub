import { resolveConnection } from "@/lib/connections";
import { decryptCredentials } from "@/lib/connections/crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { WooClient, type WooCredentials } from "./client";

export const WOO_PROVIDER = "woocommerce";

/**
 * Construit un client WooCommerce pour un tenant en resolvant sa connexion
 * (cascade tenant -> brand -> plateforme). Retourne null si non connecte.
 */
export async function getWooClientForTenant(
  tenantId: string,
): Promise<WooClient | null> {
  const direct = await getWooConnectionForTenant(tenantId);
  if (direct) return direct.client;

  const conn = await resolveConnection(tenantId, WOO_PROVIDER);
  if (!conn || conn.status !== "connected" || !conn.credentials) return null;

  const creds = conn.credentials as Partial<WooCredentials>;
  if (!creds.url || !creds.consumerKey || !creds.consumerSecret) return null;

  return new WooClient({
    url: creds.url,
    consumerKey: creds.consumerKey,
    consumerSecret: creds.consumerSecret,
  });
}

export async function getWooConnectionForTenant(
  tenantId: string,
  shopUrl?: string,
): Promise<{ connectionId: string; shopUrl: string; client: WooClient } | null> {
  const supabase = createServiceClient();

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

  const creds = decryptCredentials(
    (data.credentials as { enc?: string }) ?? {},
  ) as Partial<WooCredentials>;
  if (!creds.url || !creds.consumerKey || !creds.consumerSecret) return null;

  return {
    connectionId: data.id,
    shopUrl: typeof data.external_id === "string" ? data.external_id : creds.url,
    client: new WooClient({
      url: creds.url,
      consumerKey: creds.consumerKey,
      consumerSecret: creds.consumerSecret,
    }),
  };
}

export async function listWooConnectionsForTenant(
  tenantId: string,
): Promise<Array<{ connectionId: string; shopUrl: string; client: WooClient }>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("connections")
    .select("id, credentials, external_id")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", WOO_PROVIDER)
    .eq("status", "connected")
    .order("updated_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const out: Array<{ connectionId: string; shopUrl: string; client: WooClient }> = [];
  for (const row of data) {
    if (!row.credentials || !row.id) continue;
    const creds = decryptCredentials(
      (row.credentials as { enc?: string }) ?? {},
    ) as Partial<WooCredentials>;
    if (!creds.url || !creds.consumerKey || !creds.consumerSecret) continue;
    out.push({
      connectionId: row.id,
      shopUrl: typeof row.external_id === "string" ? row.external_id : creds.url,
      client: new WooClient({
        url: creds.url,
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
      }),
    });
  }
  return out;
}

export {
  applyWooStockUpdate,
  decrementLocalProductStock,
  generateWebhookCredentials,
  getWooCredentialsForTenant,
  mapWooProductToRow,
  upsertWooProduct,
  deactivateWooProduct,
  resolveWooWebhookConnection,
  verifyWebhookSignature,
} from "./sync";
export { WooClient };
export type { WooCredentials } from "./client";
