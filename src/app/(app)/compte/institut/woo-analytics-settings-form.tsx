"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  saveWooAnalyticsSettings,
  type AnalyticsSettingsActionResult,
} from "./woo-analytics-actions";
import { Button } from "@/components/ui/button";
import type { AnalyticsSettings } from "@/lib/institut/analytics-settings";

const initial: AnalyticsSettingsActionResult = {};

export function WooAnalyticsSettingsForm({
  settings,
}: {
  settings: AnalyticsSettings;
}) {
  const t = useTranslations("institut.woo.analytics");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveWooAnalyticsSettings, initial);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-600">{state.message ?? t("saved")}</p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="include_woo_sales"
          defaultChecked={settings.include_woo_sales}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">{t("includeTitle")}</span>
          <span className="mt-0.5 block text-sm text-slate-500">{t("includeHint")}</span>
        </span>
      </label>

      <Button type="submit" disabled={pending} variant="outline">
        {pending ? tCommon("loading") : tCommon("save")}
      </Button>
    </form>
  );
}
