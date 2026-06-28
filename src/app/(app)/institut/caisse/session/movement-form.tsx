"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addCashMovement } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initial: ActionResult = {};

const MOVEMENT_TYPES = ["in", "out", "expense"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

type PresetKey =
  | "changeFund"
  | "ownerDeposit"
  | "bankDeposit"
  | "safeTransfer"
  | "supplies"
  | "pettyPurchase"
  | "otherExpense";

const PRESET_KEYS: Record<MovementType, PresetKey[]> = {
  in: ["changeFund", "ownerDeposit"],
  out: ["bankDeposit", "safeTransfer"],
  expense: ["supplies", "pettyPurchase", "otherExpense"],
};

export function MovementForm() {
  const t = useTranslations("pos.session.movementForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(addCashMovement, initial);
  const [movementType, setMovementType] = useState<MovementType>("out");
  const [reason, setReason] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="movement_type" value={movementType} />

      <Field label={t("typeLabel")} htmlFor="movement-type">
        <div className="grid gap-2 sm:grid-cols-3" id="movement-type" role="radiogroup">
          {MOVEMENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={movementType === type}
              onClick={() => setMovementType(type)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                movementType === type
                  ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className="block text-sm font-medium text-slate-900">{t(`types.${type}`)}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{t(`typeHints.${type}`)}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("amountLabel")} htmlFor="movement-amount">
        <Input
          id="movement-amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          className="max-w-[160px]"
          required
        />
      </Field>

      <Field label={t("reasonLabel")} htmlFor="movement-reason">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESET_KEYS[movementType].map((key) => {
            const label = t(`presets.${key}` as `presets.${PresetKey}`);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setReason(label)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              >
                {label}
              </button>
            );
          })}
        </div>
        <Textarea
          id="movement-reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          rows={2}
          required
        />
      </Field>

      <Button type="submit" variant="outline" disabled={pending || !reason.trim()}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
