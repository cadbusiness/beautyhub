"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import type { PlatformSettingsPublic } from "@/lib/platform/settings";
import { saveAssistantSettings, type SettingsActionResult } from "./actions";

export function AssistantSettingsForm({ settings }: { settings: PlatformSettingsPublic }) {
  const t = useTranslations("admin.settings");
  const [state, action, pending] = useActionState(saveAssistantSettings, {} as SettingsActionResult);

  return (
    <Card>
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t("aiTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("aiDescription")}</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="ai_enabled"
            defaultChecked={settings.aiEnabled}
            className="rounded border-slate-300"
          />
          {t("aiEnabled")}
        </label>

        <Field label={t("aiModel")} htmlFor="ai_model">
          <Input
            id="ai_model"
            name="ai_model"
            defaultValue={settings.aiModel}
            placeholder="gpt-4o-mini"
          />
        </Field>

        <Field label={t("openAiKey")} htmlFor="openai_api_key">
          <Input
            id="openai_api_key"
            name="openai_api_key"
            type="password"
            autoComplete="off"
            placeholder={settings.hasOpenAiKey ? t("openAiKeyPlaceholderSet") : t("openAiKeyPlaceholder")}
          />
          {settings.hasOpenAiKey ? (
            <p className="mt-1 text-xs text-emerald-600">{t("openAiKeyConfigured")}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">{t("openAiKeyHint")}</p>
          )}
        </Field>

        {settings.hasOpenAiKey ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="clear_openai_api_key"
              className="rounded border-slate-300"
            />
            {t("clearOpenAiKey")}
          </label>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("supportTitle")}</h3>
          <p className="mt-1 text-sm text-slate-500">{t("supportDescription")}</p>
          <div className="mt-3">
            <Field label={t("supportNotifyEmail")} htmlFor="support_notify_email">
              <Input
                id="support_notify_email"
                name="support_notify_email"
                type="email"
                defaultValue={settings.supportNotifyEmail ?? ""}
                placeholder={t("supportNotifyEmailPlaceholder")}
              />
            </Field>
          </div>
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-emerald-600">{state.message}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </form>
    </Card>
  );
}
