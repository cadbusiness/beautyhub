import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import { fetchPublicQuoteByToken } from "@/lib/institut/commercial-documents";
import { loadPublicSiteShellData } from "@/lib/institut/site-settings";
import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { PublicQuotePageClient } from "./public-quote-client";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tenant = await getPublicSiteTenant();
  if (!tenant) notFound();

  const supabase = await createClient();
  const quote = await fetchPublicQuoteByToken(supabase, token);
  if (!quote) notFound();

  const tNav = await getTranslations("public.site.nav");
  const shell = await loadPublicSiteShellData(supabase, tenant, {
    home: tNav("home"),
    book: tNav("book"),
    account: tNav("account"),
  });

  const displayName =
    (quote.branding.display_name as string | null | undefined) ?? tenant.name;
  const primaryColor = quote.branding.primary_color ?? shell.primaryColor;
  const logoUrl = quote.branding.logo_url ?? shell.logoUrl;

  return (
    <PublicSiteShell shell={shell} activePath="">
      <div className="mx-auto max-w-3xl px-4 lg:px-6">
        <PublicQuotePageClient
          token={token}
          quote={quote}
          displayName={displayName}
          primaryColor={primaryColor}
          logoUrl={logoUrl}
        />
      </div>
    </PublicSiteShell>
  );
}
