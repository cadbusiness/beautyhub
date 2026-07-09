import { NextResponse } from "next/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { getTenantConnectionStatus } from "@/lib/connections";
import { normalizeShopUrl } from "@/lib/connectors/pairing";
import { WOO_PROVIDER } from "@/lib/woocommerce";

export async function GET(request: Request) {
  try {
    const session = await requireInstitutSettingsModule();
    const shopUrl = new URL(request.url).searchParams.get("shopUrl");
    if (!shopUrl) {
      return NextResponse.json({ error: "missing_shop_url" }, { status: 400 });
    }
    const normalizedShopUrl = normalizeShopUrl(shopUrl);

    const woo = await getTenantConnectionStatus(
      session.tenant.id,
      WOO_PROVIDER,
      normalizedShopUrl,
    );
    const connected = woo?.status === "connected";
    const configUrl =
      typeof woo?.config?.url === "string" ? woo.config.url : null;
    const matched =
      connected &&
      configUrl !== null &&
      normalizeShopUrl(configUrl) === normalizedShopUrl;

    return NextResponse.json({
      connected: matched,
      shopUrl: configUrl,
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
