import { createServiceClient } from "@/lib/supabase/service";
import { WOO_PROVIDER, generateWebhookCredentials } from "@/lib/woocommerce";

/** Assure les credentials webhook dans le config tenant (sans écraser l'existant). */
export async function ensureWebhookConfigForTenant(
  tenantId: string,
  shopUrl: string,
): Promise<Record<string, unknown>> {
  const existing = await getTenantConnectionStatusService(tenantId);
  const prev = existing?.config ?? {};

  if (
    typeof prev.webhook_token === "string" &&
    typeof prev.webhook_secret === "string"
  ) {
    return {
      url: shopUrl,
      webhook_token: prev.webhook_token,
      webhook_secret: prev.webhook_secret,
      paired_at: new Date().toISOString(),
    };
  }

  const creds = generateWebhookCredentials();
  return {
    url: shopUrl,
    webhook_token: creds.webhookToken,
    webhook_secret: creds.webhookSecret,
    paired_at: new Date().toISOString(),
  };
}

export { WOO_PROVIDER };

async function getTenantConnectionStatusService(tenantId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("connections")
    .select("status, config")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", WOO_PROVIDER)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as "connected" | "disconnected",
    config: (data.config as Record<string, unknown>) ?? {},
  };
}
