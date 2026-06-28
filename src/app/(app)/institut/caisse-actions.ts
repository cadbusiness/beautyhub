"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/db/database.types";
import { requireModule } from "@/lib/auth/guards";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import {
  executePosCheckout,
  parsePaymentsJson,
  type SalePaymentInput,
} from "@/lib/institut/pos-checkout";
import { parseCartDiscountCents } from "@/lib/institut/pos-totals";
import { computeCartTotals } from "@/lib/institut/pos-totals";
import { parsePosCart, resolveCartLines } from "@/lib/institut/pos";
import {
  getPosSettings,
  vatRateForLineType,
  type PosPaymentMethodsConfig,
  DEFAULT_POS_PAYMENT_METHODS,
} from "@/lib/institut/pos-settings";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
  saleId?: string;
  ticketNumber?: string;
}

function parseEurosCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function revalidateCaisse() {
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/historique");
  revalidatePath("/institut/caisse/produits");
  revalidatePath("/compte/institut/caisse");
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

async function translateCheckoutError(error: unknown): Promise<string> {
  const t = await getTranslations("institut.actions");
  const code = (error as Error).message;
  if (code === "invalid_cart") return t("invalidCart");
  if (code === "empty_cart") return t("emptyCart");
  if (code === "invalid_amount") return t("invalidAmount");
  if (code === "no_payments") return t("noPayments");
  if (code === "overpaid") return t("overpaid");
  if (code.startsWith("payment_method_disabled:")) {
    return t("paymentMethodDisabled", {
      method: code.split(":")[1] ?? "",
    });
  }
  if (code === "sale_error") return t("saleError");
  if (code === "no_open_session") return t("noOpenSession");
  if (code === "gift_card_invalid") return t("giftCardInvalid");
  if (code === "gift_card_insufficient") return t("giftCardInsufficient");
  if (code === "gift_card_expired") return t("giftCardExpired");
  if (code === "gift_card_code_required") return t("giftCardCodeRequired");
  if (code === "credit_note_invalid") return t("creditNoteInvalid");
  if (code === "credit_note_insufficient") return t("creditNoteInsufficient");
  if (code === "credit_note_expired") return t("creditNoteExpired");
  if (code === "credit_note_ref_required") return t("creditNoteRefRequired");
  return code;
}

function parsePaymentMethodsForm(formData: FormData): PosPaymentMethodsConfig {
  const methods = { ...DEFAULT_POS_PAYMENT_METHODS };
  for (const key of Object.keys(methods) as (keyof PosPaymentMethodsConfig)[]) {
    methods[key] = formData.get(`pm_${key}`) === "on";
  }
  return methods;
}

function buildCheckoutMessage(
  result: Awaited<ReturnType<typeof executePosCheckout>>,
  payments: SalePaymentInput[],
): string {
  const parts: string[] = [];
  if (result.ticketNumber) parts.push(result.ticketNumber);
  if (result.status === "partial") {
    parts.push(
      `Acompte ${(result.amountPaidCents / 100).toFixed(2)} € / ${(result.totalCents / 100).toFixed(2)} €`,
    );
  }
  if (payments.length === 1) {
    parts.push(payments[0].method);
  } else if (payments.length > 1) {
    parts.push(`${payments.length} paiements`);
  }
  return parts.join(" · ");
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
    price_cents: parseEurosCents(formData.get("price")),
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

export async function savePosSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutSettingsModule();
  const supabase = await createClient();

  const fiscalRegime = String(formData.get("fiscal_regime") ?? "standard");
  const validRegimes = ["standard", "nf525", "be_vat", "be_gks"] as const;

  const payload = {
    tenant_id: session.tenant.id,
    country_code: String(formData.get("country_code") ?? "FR").trim() || "FR",
    currency: String(formData.get("currency") ?? "eur").trim().toLowerCase() || "eur",
    price_display: String(formData.get("price_display") ?? "ttc") === "ht" ? "ht" : "ttc",
    default_vat_rate_bps: Math.round(
      Number.parseFloat(String(formData.get("default_vat_rate") ?? "20")) * 100,
    ),
    service_vat_rate_bps: Math.round(
      Number.parseFloat(String(formData.get("service_vat_rate") ?? "20")) * 100,
    ),
    product_vat_rate_bps: Math.round(
      Number.parseFloat(String(formData.get("product_vat_rate") ?? "20")) * 100,
    ),
    payment_methods: parsePaymentMethodsForm(formData) as unknown as Json,
    ticket_header: String(formData.get("ticket_header") ?? "").trim() || null,
    ticket_footer: String(formData.get("ticket_footer") ?? "").trim() || null,
    legal_name: String(formData.get("legal_name") ?? "").trim() || null,
    legal_address: String(formData.get("legal_address") ?? "").trim() || null,
    vat_number: String(formData.get("vat_number") ?? "").trim() || null,
    siret: String(formData.get("siret") ?? "").trim() || null,
    ticket_prefix: String(formData.get("ticket_prefix") ?? "TK").trim() || "TK",
    fiscal_regime: validRegimes.includes(fiscalRegime as (typeof validRegimes)[number])
      ? fiscalRegime
      : "standard",
    require_open_session: formData.get("require_open_session") === "on",
    default_opening_float_cents: parseEurosCents(formData.get("default_opening_float")),
  };

  const { error } = await supabase.from("inst_pos_settings").upsert(payload, {
    onConflict: "tenant_id",
  });
  if (error) return { error: error.message };

  revalidateCaisse();
  return { ok: true, message: t("posSettingsSaved") };
}

export async function checkoutPos(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();

  const cartJson = String(formData.get("cart") ?? "{}");
  const paymentsJson = String(formData.get("payments") ?? "[]");
  let payments: SalePaymentInput[];
  try {
    payments = parsePaymentsJson(paymentsJson);
  } catch {
    return { error: t("invalidPayments") };
  }

  try {
    const result = await executePosCheckout(supabase, session.tenant.id, {
      cartJson,
      clientId: String(formData.get("client_id") ?? "") || null,
      staffId: String(formData.get("staff_id") ?? "") || null,
      appointmentId: String(formData.get("appointment_id") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      cartDiscountCents: parseCartDiscountCents(
        String(formData.get("cart_discount") ?? "0"),
      ),
      payments,
    });

    revalidateCaisse();
    return {
      ok: true,
      message: `${t("saleRecorded")} · ${buildCheckoutMessage(result, payments)}`,
      saleId: result.saleId,
      ticketNumber: result.ticketNumber ?? undefined,
    };
  } catch (e) {
    if ((e as Error).message.includes("Prestation introuvable") ||
        (e as Error).message.includes("Produit introuvable")) {
      return { error: await translateCartLineError(e) };
    }
    return { error: await translateCheckoutError(e) };
  }
}

/** @deprecated Utiliser checkoutPos — conservé pour compatibilité Stripe legacy */
export type PaymentMethod = "cash" | "card" | "stripe";

export async function processPosCheckout(
  cartJson: string,
  clientId: string | null,
  paymentMethod: PaymentMethod,
  options?: {
    stripePaymentIntentId?: string;
    notes?: string;
    cartDiscountCents?: number;
    totalCents?: number;
  },
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();

  const settings = await getPosSettings(supabase, session.tenant.id);
  let total = options?.totalCents;
  if (total == null) {
    try {
      const cart = parsePosCart(cartJson);
      const lines = await resolveCartLines(supabase, session.tenant.id, cart);
      const totals = computeCartTotals(lines, {
        priceDisplay: settings.price_display,
        vatRateForType: (type) => vatRateForLineType(settings, type),
        cartDiscountCents: options?.cartDiscountCents ?? 0,
      });
      total = totals.total_cents;
    } catch (e) {
      return { error: await translateCartLineError(e) };
    }
  }

  try {
    const result = await executePosCheckout(supabase, session.tenant.id, {
      cartJson,
      clientId,
      notes: options?.notes,
      cartDiscountCents: options?.cartDiscountCents ?? 0,
      stripePaymentIntentId: options?.stripePaymentIntentId,
      payments: [
        {
          method: paymentMethod,
          amount_cents: total,
          reference: options?.stripePaymentIntentId,
        },
      ],
    });

    revalidateCaisse();
    return {
      ok: true,
      message: t("saleRecorded"),
      saleId: result.saleId,
      ticketNumber: result.ticketNumber ?? undefined,
    };
  } catch (e) {
    return { error: await translateCheckoutError(e) };
  }
}

export async function checkoutCash(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return checkoutPos(_prev, formData);
}

export async function checkoutCardManual(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return checkoutPos(_prev, formData);
}

export async function previewPosTotals(
  cartJson: string,
  cartDiscountEuros: string,
): Promise<{
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  cart_discount_cents: number;
} | null> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  try {
    const cart = parsePosCart(cartJson);
    if (Object.keys(cart).length === 0) return null;
    const settings = await getPosSettings(supabase, session.tenant.id);
    const lines = await resolveCartLines(supabase, session.tenant.id, cart);
    const totals = computeCartTotals(lines, {
      priceDisplay: settings.price_display,
      vatRateForType: (type) => vatRateForLineType(settings, type),
      cartDiscountCents: parseCartDiscountCents(cartDiscountEuros),
    });
    return {
      subtotal_cents: totals.subtotal_cents,
      vat_cents: totals.vat_cents,
      total_cents: totals.total_cents,
      cart_discount_cents: totals.cart_discount_cents,
    };
  } catch {
    return null;
  }
}
