import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyWooStockUpdate,
  deactivateWooProduct,
  resolveWooWebhookConnection,
  upsertWooProduct,
  verifyWebhookSignature,
} from "@/lib/woocommerce";
import type { WooProduct } from "@/lib/woocommerce/client";

interface WebhookBody {
  event: string;
  payload: Record<string, unknown>;
}

function asWooProduct(payload: Record<string, unknown>): WooProduct | null {
  const id = payload.id;
  const name = payload.name;
  const price = payload.price;
  if (typeof id !== "number" || typeof name !== "string") return null;
  return {
    id,
    name,
    sku: typeof payload.sku === "string" ? payload.sku : "",
    price: typeof price === "string" ? price : "0",
    stock_quantity:
      typeof payload.stock_quantity === "number"
        ? payload.stock_quantity
        : payload.stock_quantity === null
          ? null
          : null,
    status: typeof payload.status === "string" ? payload.status : "publish",
    images: Array.isArray(payload.images)
      ? payload.images.filter(
          (img): img is { src: string } =>
            typeof img === "object" &&
            img !== null &&
            typeof (img as { src?: unknown }).src === "string",
        )
      : undefined,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const connection = await resolveWooWebhookConnection(token);
  if (!connection) {
    return NextResponse.json({ error: "unknown_token" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-beautyhub-signature");
  if (!verifyWebhookSignature(rawBody, signature, connection.webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { event, payload } = body;

  try {
    switch (event) {
      case "product.created":
      case "product.updated": {
        const product = asWooProduct(payload);
        if (!product) {
          return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        }
        await upsertWooProduct(
          supabase,
          connection.tenantId,
          connection.connectionId,
          product,
        );
        break;
      }
      case "product.stock_updated": {
        const wooId = payload.id;
        if (typeof wooId !== "number") {
          return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        }
        const stock =
          typeof payload.stock_quantity === "number"
            ? payload.stock_quantity
            : payload.stock_quantity === null
              ? null
              : null;
        await applyWooStockUpdate(
          supabase,
          connection.tenantId,
          connection.connectionId,
          wooId,
          stock,
        );
        break;
      }
      case "product.deleted": {
        const wooId = payload.id;
        if (typeof wooId !== "number") {
          return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        }
        await deactivateWooProduct(
          supabase,
          connection.tenantId,
          connection.connectionId,
          wooId,
        );
        break;
      }
      case "order.completed":
        // Stock Woo déjà ajusté ; le plugin envoie product.stock_updated par ligne si besoin.
        break;
      default:
        return NextResponse.json({ error: "unknown_event" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
