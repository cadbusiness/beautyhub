"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { closeCashSession } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import {
  buildCashBreakdownLines,
  CashBreakdownTable,
  type CashBreakdownLabelKey,
} from "@/components/institut/cash-breakdown";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const initial: ActionResult = {};

export function CloseSessionForm({
  breakdown,
}: {
  breakdown: {
    openingFloatCents: number;
    cashSalesCents: number;
    movementsInCents: number;
    movementsOutCents: number;
    movementsExpenseCents: number;
    expectedCashCents: number;
  };
}) {
  const t = useTranslations("pos.session.closeForm");
  const tBreakdown = useTranslations("pos.session.breakdown");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(closeCashSession, initial);
  const [countedEuros, setCountedEuros] = useState(
    () => (breakdown.expectedCashCents / 100).toFixed(2),
  );
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const countedCents = useMemo(() => {
    const n = Number.parseFloat(countedEuros.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [countedEuros]);

  const varianceCents = countedCents - breakdown.expectedCashCents;
  const hasVariance = varianceCents !== 0;
  const notesRequired = hasVariance && !notes.trim();
  const canSubmit = confirmed && !notesRequired && countedCents >= 0;

  const breakdownLines = buildCashBreakdownLines(
    (key: CashBreakdownLabelKey) => tBreakdown(key),
    breakdown,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("theoreticalTitle")}
        </p>
        <CashBreakdownTable lines={breakdownLines} compact />
      </div>

      <Field label={t("counted")} htmlFor="counted_cash">
        <Input
          id="counted_cash"
          name="counted_cash"
          type="number"
          min={0}
          step="0.01"
          value={countedEuros}
          onChange={(e) => setCountedEuros(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-500">{t("countedHelp")}</p>
      </Field>

      <div
        className={cn(
          "rounded-lg border px-3 py-2.5 text-sm",
          hasVariance
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-green-200 bg-green-50 text-green-900",
        )}
      >
        <p className="font-medium">{hasVariance ? t("varianceTitle") : t("balancedTitle")}</p>
        <p className="mt-0.5 tabular-nums">
          {hasVariance ? (
            <>
              {varianceCents > 0 ? t("varianceSurplus") : t("varianceShortage")}{" "}
              <span className="font-semibold">{formatPrice(Math.abs(varianceCents))}</span>
            </>
          ) : (
            t("balancedHint")
          )}
        </p>
        {hasVariance ? (
          <p className="mt-1 text-xs opacity-90">{t("varianceExplain")}</p>
        ) : null}
      </div>

      <Field label={t("notesLabel")} htmlFor="close-notes">
        <Textarea
          id="close-notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={hasVariance ? t("notesRequiredPlaceholder") : t("notesPlaceholder")}
          rows={2}
          required={hasVariance}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>{t("confirmCheckbox")}</span>
      </label>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        <p className="font-medium text-slate-700">{t("zWarningTitle")}</p>
        <p className="mt-1">{t("zWarningBody")}</p>
      </div>

      <Button type="submit" disabled={pending || !canSubmit}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
