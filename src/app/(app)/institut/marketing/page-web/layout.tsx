import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageTabLinks, type PageTabLinkItem } from "@/components/ui/page-tabs";

const TAB_HREFS: PageTabLinkItem[] = [
  { href: "/institut/marketing/page-web", exact: true, label: "" },
  { href: "/institut/marketing/page-web/theme", label: "" },
];

function TabLinksFallback() {
  return <div className="h-[45px] border-b border-slate-200" aria-hidden />;
}

export default async function PageWebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("institut.marketing.website");
  const tabs: PageTabLinkItem[] = [
    { href: "/institut/marketing/page-web", exact: true, label: t("tabs.pages") },
    { href: "/institut/marketing/page-web/theme", label: t("tabs.theme") },
  ];

  return (
    <div>
      <Suspense fallback={<TabLinksFallback />}>
        <PageTabLinks items={tabs} />
      </Suspense>
      {children}
    </div>
  );
}
