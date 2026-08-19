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
  const { syncWooCatalogForTenant } = await import(
    "@/lib/woocommerce/catalog-sync"
  );
  const supabase = await createClient();
  return syncWooCatalogForTenant(tenantId, supabase, supabase);
}

export async function syncWooProductsAction(
  _prev: SyncWooResult,
): Promise<SyncWooResult> {
  void _prev;
  const t = await getTranslations("institut.pos");
  try {
    const session = await requireModule("institut");
    const result = await syncWooProductsForTenant(session.tenant.id);
    revalidatePath("/institut/caisse");
    revalidatePath("/institut/caisse/produits");
    return { ok: true, ...result };
  } catch (e) {
    const message = (e as Error).message;
    if (message === "woo_no_shop") {
      return { error: t("syncWooNoShop") };
    }
    return { error: message || t("syncWooError") };
  }
}
