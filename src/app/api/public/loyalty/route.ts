import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { loadPublicLoyaltyView } from "@/lib/institut/loyalty-public";

/** GET — infos publiques du programme fidélité (page /fidelite, QR). */
export async function GET() {
  const tenant = await getPublicSiteTenant();
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const view = await loadPublicLoyaltyView(supabase, tenant.id);
  if (!view) {
    return NextResponse.json({ error: "program_unavailable" }, { status: 404 });
  }

  return NextResponse.json({ tenant: { name: tenant.name, slug: tenant.slug }, program: view });
}
