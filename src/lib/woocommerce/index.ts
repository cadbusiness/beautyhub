import { resolveConnection } from "@/lib/connections";
import { WooClient, type WooCredentials } from "./client";

export const WOO_PROVIDER = "woocommerce";

/**
 * Construit un client WooCommerce pour un tenant en resolvant sa connexion
 * (cascade tenant -> brand -> plateforme). Retourne null si non connecte.
 */
export async function getWooClientForTenant(
  tenantId: string,
): Promise<WooClient | null> {
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

export { WooClient };
export type { WooCredentials } from "./client";
