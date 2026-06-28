import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicSiteView } from "@/components/site/public-site-view";
import { loadPublicServices } from "@/app/(public)/reserver/actions";
import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { parseSiteBlocks, type SitePageType } from "@/lib/institut/site-pages";
import { normalizeLayoutId } from "@/lib/institut/site-page-layouts";

export default async function PublicSiteSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tenant = await getPublicSiteTenant();
  if (!tenant) notFound();

  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase
    .rpc("get_public_site_page", { p_tenant_id: tenant.id, p_slug: slug })
    .maybeSingle();

  if (!page) notFound();

  const services = await loadPublicServices();

  return (
    <PublicSiteView
      tenant={tenant}
      page={{
        page_type: page.page_type as SitePageType,
        layout_id: normalizeLayoutId(page.page_type as SitePageType, page.template_id),
        title: page.title,
        content: parseSiteBlocks(page.content),
        seo_title: page.seo_title,
        seo_description: page.seo_description,
        page_style: page.page_style,
      }}
      services={services}
      activePath={`/p/${slug}`}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const tenant = await getPublicSiteTenant();
  if (!tenant) return {};
  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase
    .rpc("get_public_site_page", { p_tenant_id: tenant.id, p_slug: slug })
    .maybeSingle();
  if (!page) return {};
  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
  };
}
