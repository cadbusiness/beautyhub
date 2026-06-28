import { requireModule } from "@/lib/auth/guards";
import { loadSiteSettingsAdmin } from "../site-actions";
import { SiteWebSubNav } from "../site-web-sub-nav";
import { SiteThemeForm } from "./site-theme-form";

export default async function SiteThemePage() {
  const session = await requireModule("institut");
  const settings = await loadSiteSettingsAdmin();

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <SiteWebSubNav />
        <SiteThemeForm settings={settings} instituteName={session.tenant.name} />
      </div>
    </div>
  );
}
