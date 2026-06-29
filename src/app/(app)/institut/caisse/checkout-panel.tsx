"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
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
  appointmentId: string;
  notes: string;
  cartDiscountEuros: string;
  loyaltyRewardId?: string;
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

const METHOD_KEYS = ["cash", "card", "transfer", "gift_card", "credit_note"] as const;

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
  appointmentId,
  notes,
  cartDiscountEuros,
  loyaltyRewardId = "",
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
  const pm = settings.payment_methods;

  const enabledMethods = useMemo(() => {
    return METHOD_KEYS.filter((key) => {
      if (key === "credit_note") return true;
      return pm[key as keyof PosPaymentMethodsConfig];
    });
  }, [pm]);

  const defaultMethod = enabledMethods[0] ?? "cash";

  const [payments, setPayments] = useState<PaymentRow[]>(() => [
    newRow(defaultMethod, eurosFromCents(totals.total_cents)),
  ]);

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
  const canSubmit =
    !disabled &&
    paymentsTotalCents > 0 &&
    !isOverpaid &&
    payments.every((p) => p.method && p.amountEuros);

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

  function addPaymentRow() {
    const amount = remainingCents > 0 ? eurosFromCents(remainingCents) : "0.00";
    setPayments((rows) => [...rows, newRow(defaultMethod, amount)]);
  }

  function removeRow(id: string) {
    setPayments((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
  }

  function fillRemaining(id: string) {
    const others = payments
      .filter((p) => p.id !== id)
      .reduce((s, p) => {
        const n = Number.parseFloat(p.amountEuros.replace(",", "."));
        return s + (Number.isFinite(n) ? Math.round(n * 100) : 0);
      }, 0);
    const left = Math.max(0, totals.total_cents - others);
    updateRow(id, { amountEuros: eurosFromCents(left) });
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>{t("subtotalHt")}</span>
          <span className="tabular-nums">{formatPrice(totals.subtotal_cents)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>{t("vat")}</span>
          <span className="tabular-nums">{formatPrice(totals.vat_cents)}</span>
        </div>
        {totals.cart_discount_cents > 0 ? (
          <div className="flex justify-between text-green-700">
            <span>{t("discount")}</span>
            <span className="tabular-nums">
              −{formatPrice(totals.cart_discount_cents)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between font-semibold text-slate-900">
          <span>{t("totalTtc")}</span>
          <span className="tabular-nums">{formatPrice(totals.total_cents)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("payments")}
        </p>
        {payments.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-2">
            <Select
              value={row.method}
              onChange={(e) => updateRow(row.id, { method: e.target.value })}
              className="min-w-[7rem] flex-1"
              aria-label={t("methodAria")}
            >
              {enabledMethods.map((m) => (
                <option key={m} value={m}>
                  {t(`methods.${m}`)}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={row.amountEuros}
              onChange={(e) => updateRow(row.id, { amountEuros: e.target.value })}
              className="w-24"
              aria-label={t("amountAria")}
            />
            {row.method === "gift_card" ? (
              <Input
                placeholder={t("giftCodePlaceholder")}
                value={row.reference}
                onChange={(e) => updateRow(row.id, { reference: e.target.value })}
                className="min-w-[6rem] flex-1"
              />
            ) : null}
            {row.method === "credit_note" ? (
              <Input
                placeholder={t("creditNotePlaceholder")}
                value={row.reference}
                onChange={(e) => updateRow(row.id, { reference: e.target.value })}
                className="min-w-[6rem] flex-1"
              />
            ) : null}
            <button
              type="button"
              onClick={() => fillRemaining(row.id)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {t("fillRemaining")}
            </button>
            {payments.length > 1 ? (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={addPaymentRow}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          + {t("addPayment")}
        </button>
      </div>

      {remainingCents !== 0 ? (
        <p
          className={`text-sm ${isOverpaid ? "text-red-600" : isPartial ? "text-amber-600" : "text-slate-500"}`}
        >
          {isOverpaid
            ? t("overpaid", { amount: formatPrice(Math.abs(remainingCents)) })
            : isPartial
              ? t("remaining", { amount: formatPrice(remainingCents) })
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
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="cart_discount" value={cartDiscountEuros} />
        <input type="hidden" name="loyalty_reward_id" value={loyaltyRewardId} />
        <input type="hidden" name="payments" value={paymentsJson} />
        <Button
          type="submit"
          className="w-full"
          disabled={!canSubmit || checkoutPending}
        >
          {checkoutPending
            ? t("submitting")
            : isPartial
              ? t("submitPartial", {
                  paid: formatPrice(paymentsTotalCents),
                  total: formatPrice(totals.total_cents),
                })
              : t("submit", { total: formatPrice(totals.total_cents) })}
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
          publishableKey={stripePublishableKey}
          stripeAccountId={stripeAccountId}
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
