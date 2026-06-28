import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadSitePageForBuilder } from "../../site-actions";
import { SitePageBuilder } from "../../site-page-builder";
import type { PublicService } from "@/app/(public)/reserver/actions";

export default async function SitePageBuilderPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const session = await requireModule("institut");
  const { pageId } = await params;
  const page = await loadSitePageForBuilder(pageId);
  if (!page) notFound();

  const supabase = await createClient();
  const { data: services } = await supabase.rpc("get_public_services", {
    p_tenant_id: session.tenant.id,
  });

  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-7rem)] flex-col lg:-mx-6">
      <SitePageBuilder
        page={page}
        previewServices={(services ?? []) as PublicService[]}
      />
    </div>
  );
}
