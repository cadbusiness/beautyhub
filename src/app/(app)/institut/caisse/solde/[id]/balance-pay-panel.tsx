"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { payBalanceAction } from "../../../caisse-session-actions";
import type { ActionResult } from "../../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import type { PosPaymentMethodsConfig, PosSettings } from "@/lib/institut/pos-settings";

const initial: ActionResult = {};
const METHOD_KEYS = ["cash", "card", "transfer", "gift_card", "credit_note"] as const;

export function BalancePayPanel({
  saleId,
  remainingCents,
  settings,
}: {
  saleId: string;
  remainingCents: number;
  settings: PosSettings;
}) {
  const t = useTranslations("pos.checkout");
  const tBalance = useTranslations("pos.balance");
  const pm = settings.payment_methods;
  const enabledMethods = METHOD_KEYS.filter((key) => {
    if (key === "credit_note") return true;
    return pm[key as keyof PosPaymentMethodsConfig];
  });
  const defaultMethod = enabledMethods[0] ?? "cash";

  const [method, setMethod] = useState<string>(defaultMethod);
  const [amountEuros, setAmountEuros] = useState((remainingCents / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [state, action, pending] = useActionState(payBalanceAction, initial);

  const amountCents = useMemo(() => {
    const n = Number.parseFloat(amountEuros.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [amountEuros]);

  const paymentsJson = JSON.stringify([
    { method, amount_cents: amountCents, reference: reference.trim() || undefined },
  ]);

  return (
    <form action={action} className="space-y-3 border-t border-slate-200 pt-3">
      <Select value={method} onChange={(e) => setMethod(e.target.value)}>
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
        value={amountEuros}
        onChange={(e) => setAmountEuros(e.target.value)}
      />
      {method === "gift_card" || method === "credit_note" ? (
        <Input
          placeholder={
            method === "gift_card" ? t("giftCodePlaceholder") : t("creditNotePlaceholder")
          }
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      ) : null}
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="payments" value={paymentsJson} />
      <Button
        type="submit"
        className="w-full"
        disabled={pending || amountCents <= 0 || amountCents > remainingCents}
      >
        {pending ? t("submitting") : tBalance("pay", { amount: formatPrice(amountCents) })}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <div className="text-sm text-green-600">
          <p>{state.message}</p>
          {state.saleId ? (
            <Link href={`/institut/caisse/ticket/${state.saleId}`} className="underline">
              {t("viewTicket")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
