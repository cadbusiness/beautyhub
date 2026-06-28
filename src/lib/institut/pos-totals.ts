import type { PosPriceDisplay } from "./pos-settings";
import type { ResolvedCartLine } from "./pos";

export interface ComputedLineTotals {
  vat_rate_bps: number;
  discount_cents: number;
  line_subtotal_cents: number;
  line_vat_cents: number;
  line_total_cents: number;
}

export interface ComputedCartTotals {
  lines: Array<ResolvedCartLine & ComputedLineTotals>;
  subtotal_cents: number;
  vat_cents: number;
  gross_cents: number;
  cart_discount_cents: number;
  total_cents: number;
}

function roundCents(value: number): number {
  return Math.round(value);
}

/** Calcule HT/TVA/TTC pour une ligne selon le mode d'affichage des prix. */
export function computeLineTotals(
  unitPriceCents: number,
  quantity: number,
  vatRateBps: number,
  discountCents: number,
  priceDisplay: PosPriceDisplay,
): ComputedLineTotals {
  const qty = Math.max(1, quantity);
  const discount = Math.max(0, discountCents);
  const raw = unitPriceCents * qty;

  if (priceDisplay === "ttc") {
    const lineTotal = Math.max(0, raw - discount);
    const lineSubtotal = roundCents(lineTotal / (1 + vatRateBps / 10000));
    const lineVat = lineTotal - lineSubtotal;
    return {
      vat_rate_bps: vatRateBps,
      discount_cents: discount,
      line_subtotal_cents: lineSubtotal,
      line_vat_cents: lineVat,
      line_total_cents: lineTotal,
    };
  }

  const lineSubtotal = Math.max(0, raw - discount);
  const lineVat = roundCents((lineSubtotal * vatRateBps) / 10000);
  return {
    vat_rate_bps: vatRateBps,
    discount_cents: discount,
    line_subtotal_cents: lineSubtotal,
    line_vat_cents: lineVat,
    line_total_cents: lineSubtotal + lineVat,
  };
}

export function computeCartTotals(
  lines: ResolvedCartLine[],
  options: {
    priceDisplay: PosPriceDisplay;
    vatRateForType: (type: "service" | "product") => number;
    cartDiscountCents?: number;
  },
): ComputedCartTotals {
  const computedLines = lines.map((line) => {
    const vatRate = options.vatRateForType(line.type);
    const totals = computeLineTotals(
      line.unit_price_cents,
      line.quantity,
      vatRate,
      0,
      options.priceDisplay,
    );
    return { ...line, ...totals };
  });

  const gross = computedLines.reduce((s, l) => s + l.line_total_cents, 0);
  const cartDiscount = Math.min(
    Math.max(0, options.cartDiscountCents ?? 0),
    gross,
  );

  let subtotal = computedLines.reduce((s, l) => s + l.line_subtotal_cents, 0);
  let vat = computedLines.reduce((s, l) => s + l.line_vat_cents, 0);
  let total = gross - cartDiscount;

  if (cartDiscount > 0 && gross > 0) {
    const ratio = (gross - cartDiscount) / gross;
    subtotal = roundCents(subtotal * ratio);
    vat = roundCents(vat * ratio);
    total = subtotal + vat;
  }

  return {
    lines: computedLines,
    subtotal_cents: subtotal,
    vat_cents: vat,
    gross_cents: gross,
    cart_discount_cents: cartDiscount,
    total_cents: total,
  };
}

export function parseCartDiscountCents(raw: string | number | null): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  const n = Number.parseFloat(String(raw ?? "0").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
