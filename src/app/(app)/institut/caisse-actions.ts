"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { getWooClientForTenant } from "@/lib/woocommerce";
import { parsePosCart, resolveCartLines } from "@/lib/institut/pos";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

function eurosToCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function revalidateCaisse() {
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/historique");
  revalidatePath("/institut/caisse/produits");
}

async function translateCartLineError(error: unknown): Promise<string> {
  const t = await getTranslations("institut.actions");
  const msg = (error as Error).message;
  const servicePrefix = "Prestation introuvable: ";
  const productPrefix = "Produit introuvable: ";
  if (msg.startsWith(servicePrefix)) {
    return t("serviceNotFoundInCart", { id: msg.slice(servicePrefix.length) });
  }
  if (msg.startsWith(productPrefix)) {
    return t("productNotFoundInCart", { id: msg.slice(productPrefix.length) });
  }
  return msg;
}

export async function createInternalProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("nameRequired") };

  const stockRaw = String(formData.get("stock_quantity") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.max(0, Number.parseInt(stockRaw, 10) || 0);

  const supabase = await createClient();
  const { error } = await supabase.from("inst_products").insert({
    tenant_id: session.tenant.id,
    name,
    sku: String(formData.get("sku") ?? "").trim() || null,
    price_cents: eurosToCents(formData.get("price")),
    stock_quantity: stock,
    source: "internal",
    status: "active",
  });
  if (error) return { error: error.message };
  revalidateCaisse();
  return { ok: true };
}

export async function deleteInternalProduct(formData: FormData): Promise<void> {
  await requireModule("institut");
  const supabase = await createClient();
  await supabase
    .from("inst_products")
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("source", "internal");
  revalidateCaisse();
}

export type PaymentMethod = "cash" | "card" | "stripe";

export async function processPosCheckout(
  cartJson: string,
  clientId: string | null,
  paymentMethod: PaymentMethod,
  options?: {
    stripePaymentIntentId?: string;
    notes?: string;
  },
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();

  let cart: Record<string, number>;
  try {
    cart = parsePosCart(cartJson);
  } catch {
    return { error: t("invalidCart") };
  }
  if (Object.keys(cart).length === 0) return { error: t("emptyCart") };

  let lines;
  try {
    lines = await resolveCartLines(supabase, session.tenant.id, cart);
  } catch (e) {
    return { error: await translateCartLineError(e) };
  }

  const total = lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
  if (total <= 0) return { error: t("invalidAmount") };

  if (options?.stripePaymentIntentId) {
    const { data: dup } = await supabase
      .from("inst_sales")
      .select("id")
      .eq("tenant_id", session.tenant.id)
      .eq("stripe_payment_intent_id", options.stripePaymentIntentId)
      .maybeSingle();
    if (dup) return { ok: true, message: t("saleAlreadyRecorded") };
  }

  const wooClient = await getWooClientForTenant(session.tenant.id);
  let wooOrderId: number | null = null;
  if (wooClient) {
    const lineItems = lines
      .filter((l) => l.type === "product" && l.woo_id)
      .map((l) => ({ product_id: Number(l.woo_id), quantity: l.quantity }));
    if (lineItems.length > 0) {
      try {
        const order = await wooClient.createOrder(lineItems, { setPaid: true });
        wooOrderId = order.id;
      } catch (e) {
        return { error: t("wooOrderFailed", { message: (e as Error).message }) };
      }
    }
  }

  const { data: sale, error: saleErr } = await supabase
    .from("inst_sales")
    .insert({
      tenant_id: session.tenant.id,
      client_id: clientId,
      woo_order_id: wooOrderId,
      total_cents: total,
      status: "paid",
      payment_method: paymentMethod,
      stripe_payment_intent_id: options?.stripePaymentIntentId ?? null,
      notes: options?.notes ?? null,
    })
    .select("id")
    .single();
  if (saleErr || !sale) return { error: saleErr?.message ?? t("saleError") };

  const { error: itemsErr } = await supabase.from("inst_sale_items").insert(
    lines.map((l) => ({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      item_type: l.type,
      product_id: l.product_id,
      service_id: l.service_id,
      name: l.name,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
    })),
  );
  if (itemsErr) return { error: itemsErr.message };

  revalidateCaisse();
  const parts: string[] = [t("saleRecorded")];
  if (wooOrderId) parts.push(`Woo #${wooOrderId}`);
  if (paymentMethod === "cash") parts.push(t("paymentCash"));
  if (paymentMethod === "stripe") parts.push(t("paymentStripe"));
  if (paymentMethod === "card") parts.push(t("paymentCard"));
  return { ok: true, message: parts.join(" · ") };
}

export async function checkoutCash(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return processPosCheckout(
    String(formData.get("cart") ?? "{}"),
    String(formData.get("client_id") ?? "") || null,
    "cash",
    { notes: String(formData.get("notes") ?? "").trim() || undefined },
  );
}

export async function checkoutCardManual(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return processPosCheckout(
    String(formData.get("cart") ?? "{}"),
    String(formData.get("client_id") ?? "") || null,
    "card",
    { notes: String(formData.get("notes") ?? "").trim() || undefined },
  );
}
