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
  WOO_PROVIDER,
  WooClient,
  generateWebhookCredentials,
  getWooClientForTenant,
  mapWooProductToRow,
} from "@/lib/woocommerce";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

async function ensureWebhookConfig(
  tenantId: string,
  url: string,
): Promise<Record<string, unknown>> {
  const existing = await getTenantConnectionStatus(tenantId, WOO_PROVIDER);
  const prev = existing?.config ?? {};

  if (
    typeof prev.webhook_token === "string" &&
    typeof prev.webhook_secret === "string"
  ) {
    return { url, webhook_token: prev.webhook_token, webhook_secret: prev.webhook_secret };
  }

  const creds = generateWebhookCredentials();
  return {
    url,
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

  try {
    const client = new WooClient({ url, consumerKey, consumerSecret });
    await client.testConnection();
  } catch (e) {
    return { error: t("connectionFailed", { message: (e as Error).message }) };
  }

  try {
    const config = await ensureWebhookConfig(session.tenant.id, url);
    await saveTenantConnection(
      session.tenant.id,
      WOO_PROVIDER,
      { url, consumerKey, consumerSecret },
      config,
      "connected",
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
  await disconnectTenantConnection(session.tenant.id, WOO_PROVIDER);
  revalidatePath(COMPTE_INSTITUT_WOO);
  revalidatePath("/institut/caisse");
}

export async function syncWooProducts(): Promise<void> {
  const session = await requireModule("institut");
  const client = await getWooClientForTenant(session.tenant.id);
  if (!client) return;

  const supabase = await createClient();

  for (let page = 1; page <= 5; page++) {
    const products = await client.listProducts(page, 50);
    if (products.length === 0) break;

    const rows = products.map((p) => mapWooProductToRow(session.tenant.id, p));

    await supabase
      .from("inst_products")
      .upsert(rows, { onConflict: "tenant_id,woo_id" });

    if (products.length < 50) break;
  }

  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/produits");
}
