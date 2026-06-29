import { NextResponse } from "next/server";
import { fetchMobileBootstrapByBundleId } from "@/lib/mobile/bootstrap";
import { MOBILE_HEADERS } from "@/lib/mobile/types";

/**
 * Bootstrap au lancement d'une app mobile marque blanche.
 * Le client natif envoie son bundle id (iOS ou Android) pour résoudre brand/tenant + thème.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const bundleId =
    request.headers.get(MOBILE_HEADERS.bundleId) ??
    url.searchParams.get("bundleId") ??
    "";

  if (!bundleId.trim()) {
    return NextResponse.json({ error: "bundle_id_required" }, { status: 400 });
  }

  try {
    const bootstrap = await fetchMobileBootstrapByBundleId(bundleId.trim());
    if (!bootstrap) {
      return NextResponse.json({ error: "app_not_found" }, { status: 404 });
    }
    return NextResponse.json(bootstrap);
  } catch (e) {
    const message = e instanceof Error ? e.message : "bootstrap_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
