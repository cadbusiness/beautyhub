"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { generateXReport } from "../../caisse-session-actions";
import { Button } from "@/components/ui/button";

export function XReportButton() {
  const t = useTranslations("pos.session");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await generateXReport();
    if (result.error) setError(result.error);
    else if (result.message) setMessage(result.message);
    setPending(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{t("xReportTitle")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("xReportHint")}</p>
        </div>
        <Button type="button" variant="outline" disabled={pending} onClick={handleClick} className="h-9 shrink-0">
          {pending ? "…" : t("generateX")}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-xs text-green-700">
          {t("xReportGenerated", { number: message })}
        </p>
      ) : null}
    </div>
  );
}
