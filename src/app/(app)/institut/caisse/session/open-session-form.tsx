"use client";

import Link from "next/link";
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
  const tSession = useTranslations("pos.session");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(openCashSession, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-900" htmlFor="opening_float">
          {t("float")}
        </label>
        <Input
          id="opening_float"
          name="opening_float"
          type="number"
          min={0}
          step="0.01"
          defaultValue={(defaultFloat / 100).toFixed(2)}
          className="max-w-[160px]"
        />
        <p className="mt-1.5 text-xs text-slate-500">{t("floatHelp")}</p>
        {defaultFloat > 0 ? (
          <p className="mt-1 text-xs text-slate-400">
            {t("defaultHint", { amount: formatPrice(defaultFloat) })}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending} className="h-10 w-full sm:w-auto">
        {pending ? tCommon("saving") : t("submit")}
      </Button>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p>{state.message}</p>
          <Link href="/institut/caisse" className="mt-2 inline-flex font-medium underline">
            {tSession("goToPosAfterOpen")} →
          </Link>
        </div>
      ) : null}
    </form>
  );
}
