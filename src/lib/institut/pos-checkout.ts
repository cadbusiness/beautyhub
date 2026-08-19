import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import type { Database } from "@/lib/db/database.types";
import { decrementLocalProductStock, decrementWooMirrorStock } from "@/lib/woocommerce/sync";
import { applyPriceOverrides, parsePosCart, resolveCartLines } from "./pos";
import {
  formatTicketNumber,
  getPosSettings,
  rememberDiscountReason,
  vatRateForLineType,
  type PosSettings,
} from "./pos-settings";
import { computeCartTotals, parseCartDiscountCents } from "./pos-totals";
import { requireOpenSessionIfNeeded, getOpenCashSession } from "./pos-session";
import { isPreviousCalendarDay } from "@/lib/date";
import {
  findCreditNoteByNumber,
  findGiftCardByCode,
  redeemCreditNote,
  redeemGiftCard,
} from "./pos-vouchers";
import { getVoucherByCode, redeemVoucher } from "./vouchers-core";
import { processLoyaltyForPaidSale } from "./loyalty";
import {
  LoyaltyRedeemError,
  previewLoyaltyCreditCents,
  previewLoyaltyDiscountCents,
  redeemLoyaltyAtSale,
  redeemLoyaltyCreditAtSale,
} from "./loyalty-redeem";
import { normalizePromoCode, redeemPromo, validatePromo } from "./promos-core";
import { generateSaleDocuments, updateSaleDocumentStatuses } from "./sale-documents/generate";
import { markPosCartCheckedOut } from "./pos-carts";

type Db = SupabaseClient<Database>;

function enqueueAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

export type SalePaymentMethod =
  | "cash"
  | "card"
  | "stripe"
  | "transfer"
  | "voucher"
  | "gift_card"
  | "credit_note"
  | "other";

export interface SalePaymentInput {
  method: SalePaymentMethod;
  amount_cents: number;
  reference?: string;
}

export interface PosCheckoutInput {
  cartJson: string;
  clientId: string | null;
  notes?: string;
  cartDiscountCents?: number;
  payments: SalePaymentInput[];
  stripePaymentIntentId?: string;
  staffId?: string | null;
  appointmentId?: string | null;
  cashSessionId?: string | null;
  parentSaleId?: string | null;
  saleKind?: "sale" | "balance";
  /** Récompense fidélité à échanger sur cette vente (réduction appliquée avant paiement). */
  loyaltyRewardId?: string | null;
  /** Bon euros : montant à débiter (1 point = 1 centime), tout ou partie. */
  loyaltyCreditCents?: number | null;
  /** Code promo marketing (désactive la remise manuelle côté UI). */
  promoCode?: string | null;
  /**
   * Surcharges de prix unitaires par clé de panier (`service:{id}` / `product:{id}`),
   * en centimes (mode HT/TTC identique au catalogue). Permet de facturer un tarif
   * spécifique à un client sans modifier le catalogue.
   */
  priceOverrides?: Record<string, number> | null;
  /** Motif de remise manuelle — mémorisé dans la bibliothèque de l'institut. */
  discountReason?: string | null;
  /** Panier partagé à clôturer après encaissement. */
  posCartId?: string | null;
}

export interface PosCheckoutResult {
  saleId: string;
  ticketNumber: string | null;
  status: "paid" | "partial";
  totalCents: number;
  amountPaidCents: number;
}

function primaryPaymentMethod(
  payments: SalePaymentInput[],
): Database["public"]["Tables"]["inst_sales"]["Insert"]["payment_method"] {
  if (payments.length === 0) return "cash";
  if (payments.length === 1) return payments[0].method;
  const methods = new Set(payments.map((p) => p.method));
  if (methods.size === 1) return payments[0].method;
  return "mixed";
}

async function nextTicketNumber(
  supabase: Db,
  tenantId: string,
  settings: PosSettings,
): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", {
    p_tenant_id: tenantId,
    p_doc_type: "ticket",
  });
  if (error || data == null) {
    throw new Error(error?.message ?? "ticket_number_failed");
  }
  return formatTicketNumber(settings.ticket_prefix, data as number);
}

interface ResolvedPayment extends SalePaymentInput {
  voucher_id?: string;
  voucher_code?: string;
  gift_card_id?: string;
  credit_note_id?: string;
}

async function resolvePaymentReferences(
  supabase: Db,
  tenantId: string,
  payments: SalePaymentInput[],
): Promise<ResolvedPayment[]> {
  const resolved: ResolvedPayment[] = [];
  for (const p of payments) {
    if (p.method === "voucher") {
      if (!p.reference?.trim()) throw new Error("voucher_code_required");
      const voucher = await getVoucherByCode(supabase, tenantId, p.reference);
      if (!voucher || voucher.status !== "active") throw new Error("voucher_invalid");
      resolved.push({
        ...p,
        voucher_id: voucher.id,
        voucher_code: voucher.code,
      });
    } else if (p.method === "gift_card") {
      if (!p.reference?.trim()) throw new Error("gift_card_code_required");
      const card = await findGiftCardByCode(supabase, tenantId, p.reference);
      if (card && card.status === "active") {
        resolved.push({ ...p, gift_card_id: card.id });
      } else {
        const voucher = await getVoucherByCode(supabase, tenantId, p.reference);
        if (!voucher || voucher.status !== "active") throw new Error("gift_card_invalid");
        resolved.push({
          ...p,
          voucher_id: voucher.id,
          voucher_code: voucher.code,
        });
      }
    } else if (p.method === "credit_note") {
      if (!p.reference?.trim()) throw new Error("credit_note_ref_required");
      const note = await findCreditNoteByNumber(supabase, tenantId, p.reference);
      if (note && note.status === "active") {
        resolved.push({ ...p, credit_note_id: note.id });
      } else {
        const voucher = await getVoucherByCode(supabase, tenantId, p.reference);
        if (!voucher || voucher.status !== "active") throw new Error("credit_note_invalid");
        resolved.push({
          ...p,
          voucher_id: voucher.id,
          voucher_code: voucher.code,
        });
      }
    } else {
      resolved.push(p);
    }
  }
  return resolved;
}

export interface ResolvedPosCartTotals {
  lines: Awaited<ReturnType<typeof resolveCartLines>>;
  totals: ReturnType<typeof computeCartTotals>;
  preSubtotalCents: number;
  loyaltyDiscountCents: number;
  promoDiscountCents: number;
  promoCode: string | null;
  manualDiscountCents: number;
  cartDiscountCents: number;
  settings: PosSettings;
}

/** Calcule les totaux panier avec promo, remise manuelle et récompense fidélité. */
export async function resolvePosCartTotals(
  supabase: Db,
  tenantId: string,
  input: {
    cartJson: string;
    cartDiscountCents?: number;
    clientId?: string | null;
    loyaltyRewardId?: string | null;
    loyaltyCreditCents?: number | null;
    promoCode?: string | null;
    priceOverrides?: Record<string, number> | null;
  },
): Promise<ResolvedPosCartTotals> {
  let cart: Record<string, number>;
  try {
    cart = parsePosCart(input.cartJson);
  } catch {
    throw new Error("invalid_cart");
  }
  if (Object.keys(cart).length === 0) throw new Error("empty_cart");

  const settings = await getPosSettings(supabase, tenantId);
  const rawLines = await resolveCartLines(supabase, tenantId, cart);
  const lines = applyPriceOverrides(rawLines, input.priceOverrides);

  const baseTotals = computeCartTotals(lines, {
    priceDisplay: settings.price_display,
    vatRateForType: (type) => vatRateForLineType(settings, type),
    cartDiscountCents: 0,
  });

  let promoDiscountCents = 0;
  let promoCode: string | null = null;
  const requestedPromo = normalizePromoCode(input.promoCode ?? "");
  if (requestedPromo) {
    const validated = await validatePromo(supabase, tenantId, {
      code: requestedPromo,
      channel: "pos",
      subtotalCents: baseTotals.gross_cents,
      clientId: input.clientId,
    });
    if (!validated.valid) {
      throw new Error(validated.error ?? "promo_invalid");
    }
    promoDiscountCents = validated.discount_cents;
    promoCode = requestedPromo;
  }

  const manualDiscountCents = promoCode
    ? 0
    : Math.max(0, input.cartDiscountCents ?? 0);

  const afterPromoDiscount = promoDiscountCents + manualDiscountCents;
  const preLoyaltyTotals = computeCartTotals(lines, {
    priceDisplay: settings.price_display,
    vatRateForType: (type) => vatRateForLineType(settings, type),
    cartDiscountCents: afterPromoDiscount,
  });

  let loyaltyDiscountCents = 0;
  const requestedCredit = Math.max(0, Math.floor(input.loyaltyCreditCents ?? 0));
  if (requestedCredit > 0 && input.clientId) {
    try {
      loyaltyDiscountCents = await previewLoyaltyCreditCents(
        supabase,
        tenantId,
        input.clientId,
        requestedCredit,
        preLoyaltyTotals.subtotal_cents,
      );
    } catch (e) {
      if (e instanceof LoyaltyRedeemError) throw new Error(e.message);
      throw e;
    }
  } else if (input.loyaltyRewardId && input.clientId) {
    try {
      loyaltyDiscountCents = await previewLoyaltyDiscountCents(
        supabase,
        tenantId,
        input.clientId,
        input.loyaltyRewardId,
        preLoyaltyTotals.subtotal_cents,
      );
    } catch (e) {
      if (e instanceof LoyaltyRedeemError) throw new Error(e.message);
      throw e;
    }
  }

  const cartDiscountCents = afterPromoDiscount + loyaltyDiscountCents;
  const totals = computeCartTotals(lines, {
    priceDisplay: settings.price_display,
    vatRateForType: (type) => vatRateForLineType(settings, type),
    cartDiscountCents,
  });

  return {
    lines,
    totals,
    preSubtotalCents: preLoyaltyTotals.subtotal_cents,
    loyaltyDiscountCents,
    promoDiscountCents,
    promoCode,
    manualDiscountCents,
    cartDiscountCents,
    settings,
  };
}

export async function executePosCheckout(
  supabase: Db,
  tenantId: string,
  input: PosCheckoutInput,
): Promise<PosCheckoutResult> {
  let cart: Record<string, number>;
  try {
    cart = parsePosCart(input.cartJson);
  } catch {
    throw new Error("invalid_cart");
  }
  if (Object.keys(cart).length === 0) throw new Error("empty_cart");

  const baseCartDiscountCents =
    input.cartDiscountCents ?? parseCartDiscountCents(null);

  const {
    lines,
    totals,
    preSubtotalCents,
    settings,
    promoCode,
    promoDiscountCents,
  } = await resolvePosCartTotals(supabase, tenantId, {
    cartJson: input.cartJson,
    cartDiscountCents: baseCartDiscountCents,
    clientId: input.clientId,
    loyaltyRewardId: input.loyaltyRewardId,
    loyaltyCreditCents: input.loyaltyCreditCents,
    promoCode: input.promoCode,
    priceOverrides: input.priceOverrides,
  });

  const coveredByLoyalty =
    (input.loyaltyCreditCents ?? 0) > 0 && totals.total_cents === 0;
  if (totals.total_cents < 0 || (totals.total_cents === 0 && !coveredByLoyalty)) {
    throw new Error("invalid_amount");
  }

  let sessionId = input.cashSessionId ?? null;
  const open = await getOpenCashSession(supabase, tenantId);
  if (open?.status === "paused") throw new Error("session_paused");
  if (open && isPreviousCalendarDay(open.opened_at)) {
    throw new Error("session_previous_day");
  }
  if (!sessionId) {
    if (open) sessionId = open.id;
    else await requireOpenSessionIfNeeded(supabase, tenantId);
  }

  const rawPayments = input.payments.filter((p) => p.amount_cents > 0);
  if (rawPayments.length === 0 && !coveredByLoyalty) throw new Error("no_payments");

  const payments = await resolvePaymentReferences(supabase, tenantId, rawPayments);

  for (const p of payments) {
    if (
      p.method === "voucher" ||
      p.method === "credit_note" ||
      p.method === "other" ||
      p.method === "stripe"
    ) {
      continue;
    }
    if (!settings.payment_methods[p.method as keyof typeof settings.payment_methods]) {
      throw new Error(`payment_method_disabled:${p.method}`);
    }
  }

  const amountPaid = payments.reduce((s, p) => s + p.amount_cents, 0);
  if (amountPaid < 0) throw new Error("invalid_amount");
  if (!coveredByLoyalty && amountPaid <= 0) throw new Error("invalid_amount");
  if (amountPaid > totals.total_cents) throw new Error("overpaid");

  const status: "paid" | "partial" =
    amountPaid >= totals.total_cents ? "paid" : "partial";

  if (input.stripePaymentIntentId) {
    const { data: dup } = await supabase
      .from("inst_sales")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("stripe_payment_intent_id", input.stripePaymentIntentId)
      .maybeSingle();
    if (dup) {
      return {
        saleId: dup.id,
        ticketNumber: null,
        status: "paid",
        totalCents: totals.total_cents,
        amountPaidCents: amountPaid,
      };
    }
  }

  const ticketNumber = await nextTicketNumber(supabase, tenantId, settings);
  const stripePi =
    input.stripePaymentIntentId ??
    payments.find((p) => p.method === "stripe")?.reference ??
    null;

  const { data: sale, error: saleErr } = await supabase
    .from("inst_sales")
    .insert({
      tenant_id: tenantId,
      client_id: input.clientId,
      staff_id: input.staffId ?? null,
      appointment_id: input.appointmentId ?? null,
      cash_session_id: sessionId,
      parent_sale_id: input.parentSaleId ?? null,
      sale_kind: input.saleKind ?? "sale",
      woo_order_id: null,
      source_channel: "pos",
      subtotal_cents: totals.subtotal_cents,
      discount_cents: totals.cart_discount_cents,
      vat_cents: totals.vat_cents,
      total_cents: totals.total_cents,
      amount_paid_cents: amountPaid,
      status,
      payment_method: primaryPaymentMethod(payments),
      stripe_payment_intent_id: stripePi,
      notes: input.notes ?? null,
      ticket_number: ticketNumber,
      currency: settings.currency,
    })
    .select("id")
    .single();

  if (saleErr || !sale) {
    throw new Error(saleErr?.message ?? "sale_error");
  }

  const { error: itemsErr } = await supabase.from("inst_sale_items").insert(
    totals.lines.map((l) => ({
      tenant_id: tenantId,
      sale_id: sale.id,
      item_type: l.type,
      product_id: l.product_id,
      service_id: l.service_id,
      name: l.name,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      vat_rate_bps: l.vat_rate_bps,
      discount_cents: l.discount_cents,
      line_subtotal_cents: l.line_subtotal_cents,
      line_vat_cents: l.line_vat_cents,
      line_total_cents: l.line_total_cents,
    })),
  );
  if (itemsErr) throw new Error(itemsErr.message);

  for (const p of payments) {
    if (p.voucher_id && p.voucher_code) {
      await redeemVoucher(supabase, tenantId, {
        code: p.voucher_code,
        amountCents: p.amount_cents,
        sourceChannel: "pos",
        saleId: sale.id,
        idempotencyKey: `pos:sale:${sale.id}:payment:${p.method}:${p.reference ?? p.voucher_code}:${p.amount_cents}`,
        metadata: {
          payment_method: p.method,
        },
      });
    }
    if (p.gift_card_id) {
      await redeemGiftCard(supabase, tenantId, p.gift_card_id, p.amount_cents);
    }
    if (p.credit_note_id) {
      await redeemCreditNote(supabase, tenantId, p.credit_note_id, p.amount_cents);
    }
  }

  const { error: payErr } = await supabase.from("inst_sale_payments").insert(
    payments.map((p) => ({
      tenant_id: tenantId,
      sale_id: sale.id,
      method: p.method,
      amount_cents: p.amount_cents,
      reference: p.reference ?? null,
      voucher_id: p.voucher_id ?? null,
      gift_card_id: p.gift_card_id ?? null,
      credit_note_id: p.credit_note_id ?? null,
    })),
  );
  if (payErr) throw new Error(payErr.message);

  if (status === "paid" && promoCode && promoDiscountCents > 0) {
    await redeemPromo(supabase, tenantId, {
      code: promoCode,
      channel: "pos",
      amountCents: promoDiscountCents,
      clientId: input.clientId,
      saleId: sale.id,
      idempotencyKey: `pos:sale:${sale.id}:promo:${promoCode}`,
    });
  }

  if (status === "paid" && input.clientId) {
    const creditCents = Math.max(0, Math.floor(input.loyaltyCreditCents ?? 0));
    if (creditCents > 0) {
      await redeemLoyaltyCreditAtSale(
        supabase,
        tenantId,
        input.clientId,
        creditCents,
        sale.id,
        preSubtotalCents,
      );
    } else if (input.loyaltyRewardId) {
      await redeemLoyaltyAtSale(
        supabase,
        tenantId,
        input.clientId,
        input.loyaltyRewardId,
        sale.id,
        preSubtotalCents,
      );
    }
  }

  if (status === "paid") {
    await processLoyaltyForPaidSale(supabase, tenantId, sale.id);
  }

  if (status === "paid") {
    const productLines = totals.lines.filter(
      (line): line is typeof line & { product_id: string } =>
        line.type === "product" && Boolean(line.product_id),
    );
    for (const line of productLines) {
      await decrementLocalProductStock(
        supabase,
        tenantId,
        line.product_id,
        line.quantity,
      );
    }
    if (productLines.length > 0) {
      enqueueAfterResponse(async () => {
        for (const line of productLines) {
          await decrementWooMirrorStock(
            supabase,
            tenantId,
            line.product_id,
            line.quantity,
          );
        }
      });
    }
  }

  if (status === "paid" && input.appointmentId) {
    await supabase
      .from("inst_appointments")
      .update({ status: "completed" })
      .eq("tenant_id", tenantId)
      .eq("id", input.appointmentId)
      .in("status", ["booked", "confirmed"]);
  }

  const hasProducts = totals.lines.some((line) => line.type === "product");
  try {
    await generateSaleDocuments(supabase, tenantId, sale.id, {
      ticketNumber,
      saleStatus: status,
      amountPaidCents: amountPaid,
      totalCents: totals.total_cents,
      hasProducts,
      settings,
    });
  } catch {
    // La vente est déjà enregistrée : ne pas bloquer l'encaissement mobile.
  }

  if ((input.cartDiscountCents ?? 0) > 0) {
    try {
      await rememberDiscountReason(supabase, tenantId, input.discountReason);
    } catch {
      // Bibliothèque de motifs : ne pas bloquer la vente.
    }
  }

  if (input.posCartId) {
    try {
      await markPosCartCheckedOut(supabase, tenantId, input.posCartId);
    } catch {
      // La vente est déjà enregistrée.
    }
  }

  return {
    saleId: sale.id,
    ticketNumber,
    status,
    totalCents: totals.total_cents,
    amountPaidCents: amountPaid,
  };
}

/** Encaisse le solde d'une vente partielle existante. */
export async function executeBalancePayment(
  supabase: Db,
  tenantId: string,
  saleId: string,
  payments: SalePaymentInput[],
): Promise<PosCheckoutResult> {
  const { data: sale } = await supabase
    .from("inst_sales")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", saleId)
    .single();
  if (!sale) throw new Error("sale_not_found");
  if (sale.status !== "partial") throw new Error("sale_not_partial");

  const remaining = sale.total_cents - sale.amount_paid_cents;
  const resolved = await resolvePaymentReferences(
    supabase,
    tenantId,
    payments.filter((p) => p.amount_cents > 0),
  );
  const amountPaid = resolved.reduce((s, p) => s + p.amount_cents, 0);
  if (amountPaid <= 0) throw new Error("no_payments");
  if (amountPaid > remaining) throw new Error("overpaid");

  const sessionId = await requireOpenSessionIfNeeded(supabase, tenantId);

  for (const p of resolved) {
    if (p.voucher_id && p.voucher_code) {
      await redeemVoucher(supabase, tenantId, {
        code: p.voucher_code,
        amountCents: p.amount_cents,
        sourceChannel: "pos",
        saleId,
        idempotencyKey: `pos:balance:${saleId}:payment:${p.method}:${p.reference ?? p.voucher_code}:${p.amount_cents}`,
        metadata: {
          payment_method: p.method,
          sale_kind: "balance",
        },
      });
    }
    if (p.gift_card_id) {
      await redeemGiftCard(supabase, tenantId, p.gift_card_id, p.amount_cents);
    }
    if (p.credit_note_id) {
      await redeemCreditNote(supabase, tenantId, p.credit_note_id, p.amount_cents);
    }
  }

  const { error: payErr } = await supabase.from("inst_sale_payments").insert(
    resolved.map((p) => ({
      tenant_id: tenantId,
      sale_id: saleId,
      method: p.method,
      amount_cents: p.amount_cents,
      reference: p.reference ?? null,
      voucher_id: p.voucher_id ?? null,
      gift_card_id: p.gift_card_id ?? null,
      credit_note_id: p.credit_note_id ?? null,
    })),
  );
  if (payErr) throw new Error(payErr.message);

  const newPaid = sale.amount_paid_cents + amountPaid;
  const newStatus = newPaid >= sale.total_cents ? "paid" : "partial";

  const { error: updErr } = await supabase
    .from("inst_sales")
    .update({
      amount_paid_cents: newPaid,
      status: newStatus,
      payment_method:
        resolved.length > 1 ? "mixed" : resolved[0]?.method ?? sale.payment_method,
      cash_session_id: sale.cash_session_id ?? sessionId,
    })
    .eq("id", saleId)
    .eq("tenant_id", tenantId);
  if (updErr) throw new Error(updErr.message);

  if (newStatus === "paid") {
    await processLoyaltyForPaidSale(supabase, tenantId, saleId);
  }

  await updateSaleDocumentStatuses(
    supabase,
    tenantId,
    saleId,
    newStatus,
    newPaid,
    sale.total_cents,
  );

  return {
    saleId,
    ticketNumber: sale.ticket_number,
    status: newStatus as "paid" | "partial",
    totalCents: sale.total_cents,
    amountPaidCents: newPaid,
  };
}

export function parsePaymentsJson(raw: string): SalePaymentInput[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  const out: SalePaymentInput[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const method = String(row.method ?? "");
    const amount = Math.round(Number(row.amount_cents ?? row.amountCents ?? 0));
    if (
      ![
        "cash",
        "card",
        "stripe",
        "transfer",
        "voucher",
        "gift_card",
        "credit_note",
        "other",
      ].includes(method) ||
      amount <= 0
    ) {
      continue;
    }
    out.push({
      method: method as SalePaymentMethod,
      amount_cents: amount,
      reference:
        typeof row.reference === "string" && row.reference.trim()
          ? row.reference.trim()
          : undefined,
    });
  }
  return out;
}

export function serializePayments(payments: SalePaymentInput[]): string {
  return JSON.stringify(payments);
}
