import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  resolveWooWebhookConnection,
  verifyWebhookSignature,
} from "@/lib/woocommerce";

export async function GET(request: Request) {
  const token = request.headers.get("x-beautyhub-token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }
  const connection = await resolveWooWebhookConnection(token);
  if (!connection) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const rawBody = "";
  const signature = request.headers.get("x-beautyhub-signature");
  // GET listing: allow token-only for admin selects (HMAC optional empty body).
  if (signature && !verifyWebhookSignature(rawBody, signature, connection.webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("inst_voucher_templates")
    .select("id, name, is_default, is_active")
    .eq("tenant_id", connection.tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    templates: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      is_default: row.is_default,
    })),
  });
}
