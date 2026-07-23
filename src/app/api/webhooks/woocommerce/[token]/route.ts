import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { issueGiftCardsForWooOrder } from "@/lib/institut/woo-gift-cards";
import { redeemVoucher } from "@/lib/institut/vouchers-core";
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
    categories: Array.isArray(payload.categories)
      ? payload.categories
          .map((cat) => {
            if (typeof cat === "string") {
              return { id: 0, name: cat, slug: cat.toLowerCase().replace(/\s+/g, "-") };
            }
            if (
              typeof cat === "object" &&
              cat !== null &&
              typeof (cat as { name?: unknown }).name === "string"
            ) {
              return {
                id:
                  typeof (cat as { id?: unknown }).id === "number"
                    ? (cat as { id: number }).id
                    : 0,
                name: (cat as { name: string }).name,
                slug:
                  typeof (cat as { slug?: unknown }).slug === "string"
                    ? (cat as { slug: string }).slug
                    : (cat as { name: string }).name.toLowerCase().replace(/\s+/g, "-"),
              };
            }
            return null;
          })
          .filter(
            (cat): cat is { id: number; name: string; slug: string } =>
              cat !== null && cat.name.trim().length > 0,
          )
      : undefined,
    meta_data: Array.isArray(payload.meta_data)
      ? payload.meta_data
          .filter(
            (m): m is { key: string; value: unknown } =>
              typeof m === "object" &&
              m !== null &&
              typeof (m as { key?: unknown }).key === "string",
          )
          .map((m) => ({ key: m.key, value: (m as { value?: unknown }).value }))
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
      case "order.completed": {
        if (typeof payload.id !== "number") {
          return NextResponse.json({ error: "invalid_order" }, { status: 400 });
        }

        if (Array.isArray(payload.coupon_lines)) {
          for (const line of payload.coupon_lines) {
            if (
              typeof line === "object" &&
              line !== null &&
              typeof (line as { code?: unknown }).code === "string"
            ) {
              const code = String((line as { code: string }).code).trim().toUpperCase();
              if (!code || !/^(VC|GC|AV|BHV)[A-Z0-9-]*$/.test(code)) continue;
              const discount =
                typeof (line as { discount?: unknown }).discount === "number"
                  ? (line as { discount: number }).discount
                  : Number.parseFloat(String((line as { discount?: unknown }).discount ?? "0"));
              const amountCents = Math.max(1, Math.round(discount * 100));
              await redeemVoucher(supabase, connection.tenantId, {
                code,
                amountCents,
                sourceChannel: "woo",
                wooOrderId: payload.id,
                wooCouponCode: code,
                idempotencyKey: `woo:webhook:${payload.id}:${code}:${amountCents}`,
                metadata: {
                  event: event,
                },
              });
            }
          }
        }

        const billing =
          typeof payload.billing === "object" && payload.billing !== null
            ? (payload.billing as Record<string, unknown>)
            : null;
        const recipientName = [billing?.first_name, billing?.last_name]
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean)
          .join(" ");

        await issueGiftCardsForWooOrder(
          supabase,
          connection.tenantId,
          payload.id,
          Array.isArray(payload.line_items)
            ? (payload.line_items as Array<Record<string, unknown>>)
            : [],
          {
            recipientName: recipientName || null,
            currency: typeof payload.currency === "string" ? payload.currency : null,
          },
        );
        break;
      }
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
