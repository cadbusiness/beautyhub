"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import {
  disconnectTenantConnection,
  saveTenantConnection,
} from "@/lib/connections";
import { WOO_PROVIDER, WooClient, getWooClientForTenant } from "@/lib/woocommerce";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

function priceToCents(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function saveWooConnection(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");

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
    await saveTenantConnection(
      session.tenant.id,
      WOO_PROVIDER,
      { url, consumerKey, consumerSecret },
      { url },
      "connected",
    );
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/institut/parametres");
  revalidatePath("/institut/caisse");
  return { ok: true, message: t("wooConnected") };
}

export async function disconnectWoo(): Promise<void> {
  const session = await requireModule("institut");
  await disconnectTenantConnection(session.tenant.id, WOO_PROVIDER);
  revalidatePath("/institut/parametres");
  revalidatePath("/institut/caisse");
}

export async function syncWooProducts(): Promise<void> {
  const session = await requireModule("institut");
  const client = await getWooClientForTenant(session.tenant.id);
  if (!client) return;

  const supabase = await createClient();
  const now = new Date().toISOString();

  for (let page = 1; page <= 5; page++) {
    const products = await client.listProducts(page, 50);
    if (products.length === 0) break;

    const rows = products.map((p) => ({
      tenant_id: session.tenant.id,
      woo_id: p.id,
      name: p.name,
      sku: p.sku || null,
      price_cents: priceToCents(p.price),
      stock_quantity: p.stock_quantity,
      image_url: p.images?.[0]?.src ?? null,
      status: p.status,
      source: "woocommerce" as const,
      synced_at: now,
    }));

    await supabase
      .from("inst_products")
      .upsert(rows, { onConflict: "tenant_id,woo_id" });

    if (products.length < 50) break;
  }

  revalidatePath("/institut/caisse");
}
