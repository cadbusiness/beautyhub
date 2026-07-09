"use client";

import { useTranslations } from "next-intl";

export function WooSetupGuide({
  connected,
  connectorVersion,
}: {
  connected: boolean;
  connectorVersion: string;
}) {
  const t = useTranslations("institut.woo.setup");

  const steps = [
    { key: "download", number: 1 },
    { key: "install", number: 2 },
    { key: "connect", number: 3 },
  ] as const;

  return (
    <div className="space-y-4 border-b border-slate-200 pb-6">
      <p className="text-xs leading-relaxed text-slate-500">{t("intro")}</p>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.key} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
              {step.number}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-slate-900">{t(`steps.${step.key}.title`)}</p>
              <p className="text-slate-600">{t(`steps.${step.key}.description`)}</p>
              {step.key === "download" ? (
                <a
                  href="/downloads/beautyhub-connector.zip"
                  className="mt-1 inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50"
                >
                  {t("download", { version: connectorVersion })}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {connected ? (
        <p className="text-xs text-green-700">{t("connectedHint")}</p>
      ) : null}
    </div>
  );
}
