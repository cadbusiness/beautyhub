import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { syncWooCatalogForTenant } from "@/lib/woocommerce/catalog-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const t = await getTranslations("institut.pos");
  try {
    const session = await requireInstitutApi(request);
    const userSupabase = await createClient();
    const db = tryCreateServiceClient() ?? userSupabase;
    const result = await syncWooCatalogForTenant(session.tenant.id, db, db);
    revalidatePath("/institut/caisse");
    revalidatePath("/institut/caisse/produits");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = (e as Error).message;
    if (message === "woo_no_shop") {
      return NextResponse.json({ error: t("syncWooNoShop") }, { status: 409 });
    }
    return NextResponse.json(
      { error: message || t("syncWooError") },
      { status: 500 },
    );
  }
}
