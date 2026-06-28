import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { PublicSiteView } from "@/components/site/public-site-view";
import { loadPublicServices } from "@/app/(public)/reserver/actions";
import { loadSitePageForBuilder } from "@/app/(app)/institut/marketing/page-web/site-actions";
import { normalizeSiteBlocks } from "@/lib/institut/site-pages";

export default async function SitePagePreviewPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const session = await requireModule("institut");
  const t = await getTranslations("institut.marketing.website.previewPanel");
  const { pageId } = await params;
  const page = await loadSitePageForBuilder(pageId);
  if (!page) notFound();

  const services = await loadPublicServices();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-50 shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        {page.is_published ? t("bannerPublished") : t("bannerDraft")}
        {" · "}
        <Link href={`/institut/marketing/page-web/${pageId}/builder`} className="underline">
          {t("backToBuilder")}
        </Link>
      </div>
      <div className="flex-1">
        <PublicSiteView
          tenant={session.tenant}
          page={{
            page_type: page.page_type,
            layout_id: page.layout_id,
            title: page.title,
            content: normalizeSiteBlocks(page.content),
          seo_title: page.seo_title,
          seo_description: page.seo_description,
          page_style: page.page_style,
        }}
          services={services}
          activePath={
            page.page_type === "booking" ? "/reserver" : page.is_home ? "/" : `/p/${page.slug}`
          }
          previewMode
        />
      </div>
    </div>
  );
}
