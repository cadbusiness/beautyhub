import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { saveTenantConnectionWithService } from "@/lib/connections";
import { normalizeShopUrl, verifyPairingToken } from "@/lib/connectors/pairing";
import {
  ensureWebhookConfigForTenant,
  WOO_PROVIDER,
} from "@/lib/woocommerce/pairing-server";
import { mapWooProductToRow, WooClient } from "@/lib/woocommerce";

interface CompleteBody {
  pairing_token?: string;
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
}

export async function POST(request: Request) {
  let body: CompleteBody;
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const pairingToken = String(body.pairing_token ?? "").trim();
  const siteUrl = String(body.site_url ?? "").trim();
  const consumerKey = String(body.consumer_key ?? "").trim();
  const consumerSecret = String(body.consumer_secret ?? "").trim();

  if (!pairingToken || !siteUrl || !consumerKey || !consumerSecret) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const payload = verifyPairingToken(pairingToken);
  if (!payload) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 401 });
  }

  const normalizedSite = normalizeShopUrl(siteUrl);
  if (normalizedSite !== payload.shopUrl) {
    return NextResponse.json({ error: "shop_url_mismatch" }, { status: 400 });
  }

  const client = new WooClient({
    url: normalizedSite,
    consumerKey,
    consumerSecret,
  });

  try {
    await client.testConnection();
  } catch (e) {
    return NextResponse.json(
      { error: "woo_test_failed", message: (e as Error).message },
      { status: 400 },
    );
  }

  try {
    const config = await ensureWebhookConfigForTenant(payload.tenantId, normalizedSite);
    const supabase = createServiceClient();

    await saveTenantConnectionWithService(
      payload.tenantId,
      WOO_PROVIDER,
      { url: normalizedSite, consumerKey, consumerSecret },
      config,
      "connected",
      normalizedSite,
    );

    // Vérifie que le tenant existe toujours
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", payload.tenantId)
      .maybeSingle();
    if (!tenant) {
      return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
    }

    const { data: connection } = await supabase
      .from("connections")
      .select("id")
      .eq("scope_type", "tenant")
      .eq("scope_id", payload.tenantId)
      .eq("provider", WOO_PROVIDER)
      .eq("external_id", normalizedSite)
      .maybeSingle();

    if (connection?.id) {
      for (let page = 1; page <= 5; page++) {
        const products = await client.listProducts(page, 50);
        if (products.length === 0) break;

        const rows = products.map((p) =>
          mapWooProductToRow(payload.tenantId, connection.id, p),
        );
        await supabase
          .from("inst_products")
          .upsert(rows, { onConflict: "tenant_id,connection_id,woo_id" });

        if (products.length < 50) break;
      }
    }

    return NextResponse.json({
      ok: true,
      api_url: payload.apiUrl,
      webhook_token: config.webhook_token,
      webhook_secret: config.webhook_secret,
      shop_url: normalizedSite,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
