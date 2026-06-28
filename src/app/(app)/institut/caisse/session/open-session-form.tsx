"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { openCashSession } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

const initial: ActionResult = {};

export function OpenSessionForm({ defaultFloat }: { defaultFloat: number }) {
  const t = useTranslations("pos.session.openForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(openCashSession, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-slate-500" htmlFor="opening_float">
          {t("float")}
        </label>
        <Input
          id="opening_float"
          name="opening_float"
          type="number"
          min={0}
          step="0.01"
          defaultValue={(defaultFloat / 100).toFixed(2)}
          className="w-32"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="w-full text-sm text-green-600">{state.message}</p> : null}
      {defaultFloat > 0 ? (
        <p className="w-full text-xs text-slate-400">
          {t("defaultHint", { amount: formatPrice(defaultFloat) })}
        </p>
      ) : null}
    </form>
  );
}
