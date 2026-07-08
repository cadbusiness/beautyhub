"use client";

import { useTranslations } from "next-intl";

export function WooWebhookCredentials({
  webhookUrl,
  webhookToken,
  webhookSecret,
}: {
  webhookUrl: string;
  webhookToken: string;
  webhookSecret: string;
}) {
  const t = useTranslations("institut.woo.webhook");

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
  }

  const fields = [
    { label: t("url"), value: webhookUrl },
    { label: t("token"), value: webhookToken },
    { label: t("secret"), value: webhookSecret, masked: true },
  ];

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-medium text-slate-900">{t("title")}</p>
      <p className="text-xs text-slate-600">{t("description")}</p>
      <dl className="space-y-2">
        {fields.map((field) => (
          <div key={field.label} className="grid gap-1 sm:grid-cols-[120px_1fr_auto] sm:items-center">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {field.label}
            </dt>
            <dd className="truncate font-mono text-xs text-slate-800">
              {field.masked ? "••••••••••••••••" : field.value}
            </dd>
            <dd>
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-lg px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => copy(field.value)}
              >
                {t("copy")}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
