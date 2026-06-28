import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { MarketingPlaceholder } from "../marketing-placeholder";

export default async function MarketingPromosPage() {
  const t = await getTranslations("institut.marketing.promos");
  await requireModule("institut");

  return (
    <MarketingPlaceholder
      title={t("title")}
      description={t("description")}
      hint={t("hint")}
    />
  );
}
