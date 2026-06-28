import { requireModule } from "@/lib/auth/guards";
import { loadSitePagesAdmin } from "./site-actions";
import { SitePagesManager } from "./site-pages-manager";

export default async function MarketingPageWebPage() {
  await requireModule("institut");
  const { pages, publicBaseUrl, customDomain, homePageId } = await loadSitePagesAdmin();

  return (
    <SitePagesManager
      pages={pages}
      publicBaseUrl={publicBaseUrl}
      customDomain={customDomain}
      homePageId={homePageId}
    />
  );
}
