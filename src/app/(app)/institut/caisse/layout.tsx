import { getTranslations } from "next-intl/server";
import { SectionPanel } from "@/components/ui/section-panel";
import { navMessageKey } from "@/lib/i18n/nav";

const TAB_HREFS = [
  { href: "/institut/caisse", exact: true as const },
  { href: "/institut/caisse/session" },
  { href: "/institut/caisse/bons" },
  { href: "/institut/caisse/historique" },
  { href: "/institut/caisse/produits" },
];

export default async function CaisseLayout({
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
