"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/db/database.types";
import { getWooClientForTenant } from "@/lib/woocommerce";

const BON_PATH = "/institut/caisse/bons";

export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function parseVariationMap(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => [String(k), String(v).trim()]),
    );
  } catch {
    return {};
  }
}

export async function saveGiftProductSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const t = await getTranslations("pos.vouchers.giftProducts.actions");

  const productId = String(formData.get("product_id") ?? "").trim();
  const isGiftCard = formData.get("is_gift_card") === "1";
  const giftTemplateId = String(formData.get("gift_template_id") ?? "").trim() || null;
  const variationMap = parseVariationMap(String(formData.get("gift_variation_templates") ?? ""));

  if (!productId) return { error: t("productRequired") };

  const { data: product, error: loadErr } = await supabase
    .from("inst_products")
    .select("id, woo_id, source")
    .eq("tenant_id", session.tenant.id)
    .eq("id", productId)
    .maybeSingle();
  if (loadErr || !product) return { error: t("productRequired") };

  const { error } = await supabase
    .from("inst_products")
    .update({
      is_gift_card: isGiftCard,
      gift_template_id: giftTemplateId,
      gift_variation_templates: variationMap as Json,
    })
    .eq("tenant_id", session.tenant.id)
    .eq("id", productId);
  if (error) return { error: error.message };

  if (product.woo_id && product.source === "woocommerce") {
    const woo = await getWooClientForTenant(session.tenant.id);
    if (woo) {
      try {
        await woo.updateProductMeta(product.woo_id, [
          { key: "_beautyhub_gift_card", value: isGiftCard ? "yes" : "no" },
          { key: "_beautyhub_gift_template_id", value: giftTemplateId ?? "" },
          {
            key: "_beautyhub_gift_variation_templates",
            value: JSON.stringify(variationMap),
          },
        ]);
        for (const [variationId, templateId] of Object.entries(variationMap)) {
          const vid = Number.parseInt(variationId, 10);
          if (!Number.isFinite(vid) || vid <= 0) continue;
          await woo.updateVariationMeta(product.woo_id, vid, [
            { key: "_beautyhub_gift_template_id", value: templateId },
          ]);
        }
      } catch (e) {
        return { error: (e as Error).message || t("wooPushFailed") };
      }
    }
  }

  revalidatePath(BON_PATH);
  return { ok: true, message: t("saved") };
}
