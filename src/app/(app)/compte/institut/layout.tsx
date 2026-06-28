import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsAccess } from "@/lib/auth/institut-settings";
import { PageTabLinks, type PageTabLinkItem } from "@/components/ui/page-tabs";

function SubTabLinksFallback() {
  return <div className="h-[45px] border-b border-slate-200" aria-hidden />;
}

export default async function CompteInstitutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireInstitutSettingsAccess();
  const t = await getTranslations("account.nav");

  const tabs: PageTabLinkItem[] = [
    {
      href: "/compte/institut/woocommerce",
      label: t("woocommerce"),
      exact: true,
    },
    {
      href: "/compte/institut/stripe",
      label: t("stripe"),
      exact: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Suspense fallback={<SubTabLinksFallback />}>
        <PageTabLinks items={tabs} className="-mx-6 px-6 lg:-mx-8 lg:px-8" />
      </Suspense>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
