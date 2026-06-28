"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addCashMovement } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

const initial: ActionResult = {};

export function MovementForm() {
  const t = useTranslations("pos.session.movementForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(addCashMovement, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select name="movement_type" defaultValue="expense" className="w-36">
          <option value="in">{t("types.in")}</option>
          <option value="out">{t("types.out")}</option>
          <option value="expense">{t("types.expense")}</option>
        </Select>
        <Input
          name="amount"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          className="w-28"
          required
        />
      </div>
      <Textarea name="reason" placeholder={t("reasonPlaceholder")} rows={2} required />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
