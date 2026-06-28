"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { closeCashSession } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

const initial: ActionResult = {};

export function CloseSessionForm({ expectedCash }: { expectedCash: number }) {
  const t = useTranslations("pos.session.closeForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(closeCashSession, initial);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-slate-600">
        {t("expected")}:{" "}
        <span className="font-medium tabular-nums text-slate-900">
          {formatPrice(expectedCash)}
        </span>
      </p>
      <div>
        <label className="mb-1 block text-xs text-slate-500" htmlFor="counted_cash">
          {t("counted")}
        </label>
        <Input
          id="counted_cash"
          name="counted_cash"
          type="number"
          min={0}
          step="0.01"
          defaultValue={(expectedCash / 100).toFixed(2)}
          required
        />
      </div>
      <Textarea name="notes" placeholder={t("notesPlaceholder")} rows={2} />
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
