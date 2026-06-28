import { getTranslations } from "next-intl/server";
import { SectionPanel } from "@/components/ui/section-panel";
import { navMessageKey } from "@/lib/i18n/nav";

const TAB_HREFS = [
  { href: "/institut/marketing", exact: true as const },
  { href: "/institut/marketing/fidelite" },
  { href: "/institut/marketing/page-web" },
  { href: "/institut/marketing/promos" },
];

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tNav = await getTranslations("nav");
  const tabs = TAB_HREFS.map((tab) => {
    const labelKey = navMessageKey(tab.href);
    return {
      ...tab,
      label: labelKey ? tNav(labelKey) : tab.href,
    };
  });

  return <SectionPanel tabs={tabs}>{children}</SectionPanel>;
}
