import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { GiftProductsManager } from "@/app/(app)/institut/caisse/bons/gift-products-manager";
import { VoucherTemplatesManager } from "@/app/(app)/institut/caisse/bons/voucher-templates-manager";
import { SettingsSection } from "../settings-section";
import { PosSettingsForm } from "./pos-settings-form";

export default async function CompteInstitutCaissePage() {
  const t = await getTranslations("institut.posSettings");
  const tTemplates = await getTranslations("institut.posTemplates");
  const tGift = await getTranslations("institut.posGiftProducts");
  const session = await requireInstitutSettingsModule();
  const supabase = await createClient();

  const [settings, templatesRes, wooProductsRes] = await Promise.all([
    getPosSettings(supabase, session.tenant.id),
    supabase
      .from("inst_voucher_templates")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("inst_products")
      .select(
        "id, name, sku, woo_id, is_gift_card, gift_template_id, gift_variation_templates",
      )
      .eq("tenant_id", session.tenant.id)
      .eq("source", "woocommerce")
      .order("name")
      .limit(500),
  ]);

  const templates = templatesRes.data ?? [];
  const giftProducts = (wooProductsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    woo_id: p.woo_id,
    is_gift_card: Boolean(p.is_gift_card),
    gift_template_id: p.gift_template_id,
    gift_variation_templates:
      p.gift_variation_templates &&
      typeof p.gift_variation_templates === "object" &&
      !Array.isArray(p.gift_variation_templates)
        ? (p.gift_variation_templates as Record<string, string>)
        : {},
  }));

  return (
    <>
      <SettingsSection
        title={t("title")}
        description={t("description")}
        status={t("configured")}
        statusTone="success"
      >
        <PosSettingsForm settings={settings} />
      </SettingsSection>

      <SettingsSection
        title={tTemplates("title")}
        description={tTemplates("description")}
      >
        <VoucherTemplatesManager templates={templates} />
      </SettingsSection>

      <SettingsSection
        title={tGift("title")}
        description={tGift("description")}
      >
        <GiftProductsManager products={giftProducts} templates={templates} />
      </SettingsSection>
    </>
  );
}
