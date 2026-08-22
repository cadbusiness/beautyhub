"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPosMoney } from "@/lib/institut/pos-settings";
import type { PosPaymentMethodsConfig, PosSettings } from "@/lib/institut/pos-settings";
import type { ActionResult } from "../caisse-actions";
import { StripePosPayment } from "./stripe-pos-payment";

export interface PaymentRow {
  id: string;
  method: string;
  amountEuros: string;
  reference: string;
}

interface CheckoutPanelProps {
  cartJson: string;
  clientId: string;
  staffId: string;
  lineStaffJson?: string;
  appointmentId: string;
  notes: string;
  discountReason?: string;
  cartDiscountEuros: string;
  loyaltyRewardId?: string;
  loyaltyCreditCents?: number;
  promoCode?: string;
  priceOverridesJson?: string;
  posCartId?: string | null;
  totals: {
    subtotal_cents: number;
    vat_cents: number;
    total_cents: number;
    cart_discount_cents: number;
  };
  settings: PosSettings;
  stripeEnabled: boolean;
  stripePublishableKey?: string;
  stripeAccountId?: string;
  disabled: boolean;
  checkoutAction: (formData: FormData) => void;
  checkoutPending: boolean;
  checkoutState: ActionResult;
  onSuccess: (message: string) => void;
}

const METHOD_KEYS = ["cash", "card", "transfer", "voucher", "gift_card", "credit_note"] as const;

function newRow(method: string, amountEuros: string): PaymentRow {
  return {
    id: crypto.randomUUID(),
    method,
    amountEuros,
    reference: "",
  };
}

function eurosFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CheckoutPanel({
  cartJson,
  clientId,
  staffId,
  lineStaffJson = "{}",
  appointmentId,
  notes,
  discountReason = "",
  cartDiscountEuros,
  loyaltyRewardId = "",
  loyaltyCreditCents = 0,
  promoCode = "",
  priceOverridesJson = "",
  posCartId = null,
  totals,
  settings,
  stripeEnabled,
  stripePublishableKey,
  stripeAccountId,
  disabled,
  checkoutAction,
  checkoutPending,
  checkoutState,
  onSuccess,
}: CheckoutPanelProps) {
  const t = useTranslations("pos.checkout");
  const locale = useLocale();
  const money = (cents: number) => formatPosMoney(cents, settings, locale);
  const pm = settings.payment_methods;

  const enabledMethods = useMemo(() => {
    return METHOD_KEYS.filter((key) => {
      if (key === "credit_note" || key === "voucher") return true;
      return pm[key as keyof PosPaymentMethodsConfig];
    });
  }, [pm]);

  const defaultMethod = enabledMethods[0] ?? "cash";

  const [payments, setPayments] = useState<PaymentRow[]>(() => [
    newRow(defaultMethod, eurosFromCents(totals.total_cents)),
  ]);
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [pad, setPad] = useState("");
  const [padDirty, setPadDirty] = useState(false);

  useEffect(() => {
    setPayments((prev) => {
      if (prev.length === 1) {
        return [newRow(prev[0].method, eurosFromCents(totals.total_cents))];
      }
      return prev;
    });
  }, [totals.total_cents]);

  const paymentsTotalCents = useMemo(() => {
    return payments.reduce((sum, p) => {
      const n = Number.parseFloat(p.amountEuros.replace(",", "."));
      return sum + (Number.isFinite(n) ? Math.round(n * 100) : 0);
    }, 0);
  }, [payments]);

  const remainingCents = totals.total_cents - paymentsTotalCents;
  const isPartial = paymentsTotalCents > 0 && paymentsTotalCents < totals.total_cents;
  const isOverpaid = paymentsTotalCents > totals.total_cents;
  const zeroDue = totals.total_cents === 0;
  const canSubmit =
    !disabled &&
    !isOverpaid &&
    (zeroDue ||
      (paymentsTotalCents > 0 && payments.every((p) => p.method && p.amountEuros)));

  const paymentsJson = JSON.stringify(
    payments
      .map((p) => ({
        method: p.method,
        amount_cents: Math.round(
          Number.parseFloat(p.amountEuros.replace(",", ".")) * 100,
        ),
        reference: p.reference.trim() || undefined,
      }))
      .filter((p) => p.amount_cents > 0),
  );

  function updateRow(id: string, patch: Partial<PaymentRow>) {
    setPayments((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function removeRow(id: string) {
    setPayments((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
    setEditingMethod(null);
  }

  function rowFor(method: string) {
    return payments.find((p) => p.method === method);
  }

  function firstUnusedLabel() {
    const used = new Set(payments.map((p) => p.method));
    const next = enabledMethods.find((m) => !used.has(m));
    return next ? t(`methods.${next}`) : "";
  }

  function commitPad(raw: string) {
    if (!editingMethod) return;
    const existing = rowFor(editingMethod);
    if (!existing) return;
    const n = Number.parseFloat(raw.trim().replace(",", "."));
    const cents = Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
    updateRow(existing.id, { amountEuros: eurosFromCents(cents) });
  }

  function tapMethod(method: string) {
    const existing = rowFor(method);
    if (existing) {
      setEditingMethod(method);
      setPad(existing.amountEuros.replace(".", ","));
      setPadDirty(false);
      return;
    }
    if (remainingCents > 0) {
      setPayments((rows) => [
        ...rows,
        newRow(method, eurosFromCents(remainingCents)),
      ]);
      setEditingMethod(null);
      return;
    }
    if (payments.length === 1) {
      updateRow(payments[0].id, { method });
    }
  }

  function appendPad(token: string) {
    let next = padDirty ? pad : "";
    if (token === ",") {
      if (!padDirty) next = "0,";
      else if (!next.includes(",")) next = next.length === 0 ? "0," : `${next},`;
    } else if (token === "back") {
      next = padDirty ? next.slice(0, -1) : "";
    } else if (next.includes(",")) {
      const frac = next.split(",")[1] ?? "";
      if (frac.length < 2) next += token;
    } else if (next === "0") {
      next = token;
    } else {
      next += token;
    }
    setPad(next);
    setPadDirty(true);
    commitPad(next);
  }

  function fillEditingAll() {
    if (!editingMethod) return;
    const existing = rowFor(editingMethod);
    if (!existing) return;
    const others = payments
      .filter((p) => p.id !== existing.id)
      .reduce((s, p) => {
        const n = Number.parseFloat(p.amountEuros.replace(",", "."));
        return s + (Number.isFinite(n) ? Math.round(n * 100) : 0);
      }, 0);
    const left = Math.max(0, totals.total_cents - others);
    const formatted = eurosFromCents(left);
    updateRow(existing.id, { amountEuros: formatted });
    setPad(formatted.replace(".", ","));
    setPadDirty(true);
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>{t("subtotalHt")}</span>
          <span className="tabular-nums">{money(totals.subtotal_cents)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>{t("vat")}</span>
          <span className="tabular-nums">{money(totals.vat_cents)}</span>
        </div>
        {totals.cart_discount_cents > 0 ? (
          <div className="flex justify-between text-green-700">
            <span>{t("discount")}</span>
            <span className="tabular-nums">
              −{money(totals.cart_discount_cents)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between font-semibold text-slate-900">
          <span>{t("totalTtc")}</span>
          <span className="tabular-nums">{money(totals.total_cents)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("payments")}
        </p>
        <p className="text-xs text-slate-500">
          {isPartial && firstUnusedLabel()
            ? t("tapRemaining", {
                amount: money(remainingCents),
                method: firstUnusedLabel(),
              })
            : t("splitHint")}
        </p>
      <div className="grid grid-cols-2 gap-1.5">
        {enabledMethods.map((method) => {
          const row = rowFor(method);
          const selected = Boolean(row);
          return (
            <div key={method} className="space-y-1">
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => tapMethod(method)}
                  aria-label={t("methodAria")}
                  className={`flex min-h-9 flex-1 items-center justify-between px-2.5 text-left text-xs font-semibold ${
                    selected
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-900"
                  }`}
                >
                  <span>{t(`methods.${method}`)}</span>
                  {row ? (
                    <span className="tabular-nums">
                      {money(Math.round(Number.parseFloat(row.amountEuros.replace(",", ".")) * 100 || 0))}
                    </span>
                  ) : remainingCents > 0 ? (
                    <span className={selected ? "text-white/70" : "text-[10px] font-medium text-slate-400"}>
                      {t("fillRemaining")}
                    </span>
                  ) : null}
                </button>
                {row && payments.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="px-1.5 text-sm text-red-600"
                    aria-label="×"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {row?.method === "gift_card" ? (
                <Input
                  placeholder={t("giftCodePlaceholder")}
                  value={row.reference}
                  onChange={(e) => updateRow(row.id, { reference: e.target.value })}
                />
              ) : null}
              {row?.method === "voucher" ? (
                <Input
                  placeholder={t("voucherCodePlaceholder")}
                  value={row.reference}
                  onChange={(e) => updateRow(row.id, { reference: e.target.value })}
                />
              ) : null}
              {row?.method === "credit_note" ? (
                <Input
                  placeholder={t("creditNotePlaceholder")}
                  value={row.reference}
                  onChange={(e) => updateRow(row.id, { reference: e.target.value })}
                />
              ) : null}
            </div>
          );
        })}
      </div>
        {editingMethod ? (
          <AmountPad
            display={padDirty ? pad || "0" : pad}
            onDigit={(d) => appendPad(d)}
            onComma={() => appendPad(",")}
            onBackspace={() => appendPad("back")}
            onAll={fillEditingAll}
            onDone={() => setEditingMethod(null)}
            allLabel={t("amountAll")}
            doneLabel={t("amountOk")}
          />
        ) : null}
      </div>

      {remainingCents !== 0 ? (
        <p
          className={`text-sm ${isOverpaid ? "text-red-600" : isPartial ? "text-amber-600" : "text-slate-500"}`}
        >
          {isOverpaid
            ? t("overpaid", { amount: money(Math.abs(remainingCents)) })
            : isPartial
              ? t("remaining", { amount: money(remainingCents) })
              : null}
        </p>
      ) : null}

      {checkoutState.error ? (
        <p className="text-sm text-red-600">{checkoutState.error}</p>
      ) : null}
      {checkoutState.ok && checkoutState.saleId ? (
        <div className="space-y-1 text-sm text-green-600">
          <p>{checkoutState.message}</p>
          <Link
            href={`/institut/caisse/ticket/${checkoutState.saleId}`}
            className="underline"
            target="_blank"
          >
            {t("viewTicket")}
          </Link>
        </div>
      ) : null}

      <form action={checkoutAction}>
        <input type="hidden" name="cart" value={cartJson} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="staff_id" value={staffId} />
        <input type="hidden" name="line_staff" value={lineStaffJson} />
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="discount_reason" value={discountReason} />
        <input type="hidden" name="cart_discount" value={cartDiscountEuros} />
        <input type="hidden" name="loyalty_reward_id" value={loyaltyRewardId} />
        <input type="hidden" name="loyalty_credit_cents" value={String(loyaltyCreditCents)} />
        <input type="hidden" name="promo_code" value={promoCode} />
        <input type="hidden" name="price_overrides" value={priceOverridesJson} />
        <input type="hidden" name="payments" value={paymentsJson} />
        <input type="hidden" name="pos_cart_id" value={posCartId ?? ""} />
        <Button
          type="submit"
          className="w-full"
          disabled={!canSubmit || checkoutPending}
        >
          {checkoutPending
            ? t("submitting")
            : isPartial
              ? t("submitPartial", {
                  paid: money(paymentsTotalCents),
                  total: money(totals.total_cents),
                })
              : t("submit", { total: money(totals.total_cents) })}
        </Button>
      </form>

      {stripeEnabled &&
      pm.stripe &&
      stripePublishableKey &&
      stripeAccountId &&
      !disabled ? (
        <StripePosPayment
          cartJson={cartJson}
          clientId={clientId}
          totalCents={totals.total_cents}
          cartDiscountEuros={cartDiscountEuros}
          loyaltyRewardId={loyaltyRewardId}
          loyaltyCreditCents={loyaltyCreditCents}
          promoCode={promoCode}
          priceOverridesJson={priceOverridesJson}
          posCartId={posCartId}
          publishableKey={stripePublishableKey}
          stripeAccountId={stripeAccountId}
          currency={settings.currency}
          disabled={disabled || totals.total_cents <= 0}
          onSuccess={onSuccess}
        />
      ) : null}

      {settings.price_display === "ttc" ? (
        <p className="text-[11px] text-slate-400">{t("pricesTtcHint")}</p>
      ) : (
        <p className="text-[11px] text-slate-400">{t("pricesHtHint")}</p>
      )}
    </div>
  );
}

function AmountPad({
  display,
  onDigit,
  onComma,
  onBackspace,
  onAll,
  onDone,
  allLabel,
  doneLabel,
}: {
  display: string;
  onDigit: (digit: string) => void;
  onComma: () => void;
  onBackspace: () => void;
  onAll: () => void;
  onDone: () => void;
  allLabel: string;
  doneLabel: string;
}) {
  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];
  return (
    <div className="space-y-2 pt-1">
      <p className="text-center text-xl font-semibold tabular-nums text-slate-900">
        {display} €
      </p>
      {keys.map((row) => (
        <div key={row.join("")} className="grid grid-cols-3 gap-2">
          {row.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              className="h-9 bg-slate-50 text-base font-semibold text-slate-900"
            >
              {digit}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onComma}
          className="h-9 bg-slate-50 text-base font-semibold text-slate-900"
        >
          ,
        </button>
        <button
          type="button"
          onClick={() => onDigit("0")}
          className="h-9 bg-slate-50 text-base font-semibold text-slate-900"
        >
          0
        </button>
        <button
          type="button"
          onClick={onBackspace}
          className="h-9 bg-slate-50 text-base font-semibold text-slate-900"
        >
          ⌫
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAll}
          className="h-9 bg-slate-50 text-sm font-semibold text-slate-900"
        >
          {allLabel}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-9 bg-slate-900 text-sm font-semibold text-white"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
