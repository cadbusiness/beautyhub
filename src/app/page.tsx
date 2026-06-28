import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/auth/session";
import { LandingPage } from "@/components/marketing/landing-page";
import { PublicSiteView } from "@/components/site/public-site-view";
import { getPublicTenantFromHost, loadPublicSiteHome } from "@/lib/tenant/public-site";
import { parseSiteBlocks, type SitePageType } from "@/lib/institut/site-pages";
import { normalizeLayoutId } from "@/lib/institut/site-page-layouts";
import { loadPublicServices } from "@/app/(public)/reserver/actions";

export default async function Home() {
  const publicTenant = await getPublicTenantFromHost();

  if (publicTenant) {
    const home = await loadPublicSiteHome(publicTenant.id);
    if (home) {
      const services = await loadPublicServices();
      return (
        <PublicSiteView
          tenant={publicTenant}
          page={{
            page_type: "home" as SitePageType,
            layout_id: normalizeLayoutId("home", home.template_id),
            title: home.title,
            content: parseSiteBlocks(home.content),
            seo_title: home.seo_title,
            seo_description: home.seo_description,
          }}
          services={services}
          activePath="/"
        />
      );
    }
    redirect("/reserver");
  }

  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/dashboard");
  }

  return <LandingPage />;
}
