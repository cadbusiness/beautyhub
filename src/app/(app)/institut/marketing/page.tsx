import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { MarketingToolCard } from "./marketing-tool-card";

const TOOL_KEYS = [
  "loyalty",
  "website",
  "promos",
  "referral",
  "reviews",
  "campaigns",
] as const;

const TOOL_HREFS: Partial<Record<(typeof TOOL_KEYS)[number], string>> = {
  loyalty: "/institut/marketing/fidelite",
  website: "/institut/marketing/page-web",
  promos: "/institut/marketing/promos",
};

export default async function MarketingOverviewPage() {
  const t = await getTranslations("institut.marketing.overview");
  await requireModule("institut");

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      <div>
        <p className="text-sm text-slate-500">{t("description")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TOOL_KEYS.map((key) => {
          const href = TOOL_HREFS[key];
          const isComingSoon = !href;

          return (
            <MarketingToolCard
              key={key}
              href={href}
              title={t(`tools.${key}.title`)}
              description={t(`tools.${key}.description`)}
              status={isComingSoon ? t("comingSoon") : t("available")}
              statusTone={isComingSoon ? "warning" : "success"}
              disabled={isComingSoon}
            />
          );
        })}
      </div>
    </div>
  );
}
