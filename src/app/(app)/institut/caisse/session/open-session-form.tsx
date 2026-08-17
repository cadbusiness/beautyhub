"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { openCashSession } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

const initial: ActionResult = {};

export function OpenSessionForm({
  defaultFloat,
  currency = "eur",
  compact = false,
}: {
  defaultFloat: number;
  currency?: string;
  compact?: boolean;
}) {
  const t = useTranslations("pos.session.openForm");
  const tSession = useTranslations("pos.session");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(openCashSession, initial);
  const [withFloat, setWithFloat] = useState(defaultFloat > 0);

  return (
    <form action={action} className="space-y-3">
      <Button
        type="submit"
        name="mode"
        value="skip"
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? tCommon("saving") : t("skip")}
      </Button>

      {withFloat ? (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <label
            className="mb-1 block text-sm font-medium text-slate-900"
            htmlFor="opening_float"
          >
            {t("float")}
          </label>
          <Input
            id="opening_float"
            name="opening_float"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaultFloat > 0 ? (defaultFloat / 100).toFixed(2) : ""}
            placeholder="0"
            className="max-w-[160px]"
          />
          <p className="text-xs text-slate-500">{t("floatHelp")}</p>
          {defaultFloat > 0 ? (
            <p className="text-xs text-slate-400">
              {t("defaultHint", { amount: formatPrice(defaultFloat, currency, locale) })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="mode"
              value="float"
              disabled={pending}
              variant="outline"
              className="h-10"
            >
              {pending ? tCommon("saving") : t("submitFloat")}
            </Button>
            <button
              type="button"
              className="text-xs text-slate-500 underline hover:text-slate-800"
              onClick={() => setWithFloat(false)}
            >
              {t("hideFloat")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="text-sm text-slate-600 underline hover:text-slate-900"
          onClick={() => setWithFloat(true)}
        >
          {t("withFloatToggle")}
        </button>
      )}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p>{state.message}</p>
          {!compact ? (
            <Link href="/institut/caisse" className="mt-2 inline-flex font-medium underline">
              {tSession("goToPosAfterOpen")} →
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
