import type { Metadata } from "next";
import { AppFooter } from "@/components/app-shell/app-footer";
import { SitePageRenderer } from "@/components/site/site-page-renderer";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import type { PublicService } from "@/app/(public)/reserver/actions";
import type { SiteBlock, SiteTemplateId } from "@/lib/institut/site-pages";
import type { TenantContext } from "@/lib/tenant/context";

export function PublicSiteView({
  tenant,
  page,
  services,
  activePath = "/",
}: {
  tenant: TenantContext;
  page: {
    template_id: SiteTemplateId;
    title: string;
    content: SiteBlock[];
    seo_title: string | null;
    seo_description: string | null;
  };
  services: PublicService[];
  activePath?: string;
}) {
  const branding = tenant.branding as { primaryColor?: string };

  return (
    <PublicSiteShell tenant={tenant} activePath={activePath}>
      <SitePageRenderer
        blocks={page.content}
        templateId={page.template_id}
        services={services}
        accent={branding.primaryColor ?? "#0f172a"}
      />
      <AppFooter />
    </PublicSiteShell>
  );
}

export function sitePageMetadata(page: {
  title: string;
  seo_title: string | null;
  seo_description: string | null;
}): Metadata {
  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
  };
}
