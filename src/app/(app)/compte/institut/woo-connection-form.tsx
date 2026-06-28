"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveWooConnection, type ActionResult } from "@/app/(app)/institut/woo-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function WooConnectionForm({ defaultUrl }: { defaultUrl?: string }) {
  const t = useTranslations("institut.woo.form");
  const [state, action, pending] = useActionState(saveWooConnection, initial);

  return (
    <form action={action} className="space-y-5">
      <Field label={t("shopUrl")} htmlFor="url">
        <Input
          id="url"
          name="url"
          type="url"
          required
          defaultValue={defaultUrl}
          placeholder={t("shopUrlPlaceholder")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("consumerKey")} htmlFor="consumer_key">
          <Input
            id="consumer_key"
            name="consumer_key"
            required
            placeholder={t("consumerKeyPlaceholder")}
          />
        </Field>
        <Field label={t("consumerSecret")} htmlFor="consumer_secret">
          <Input
            id="consumer_secret"
            name="consumer_secret"
            type="password"
            required
            placeholder={t("consumerSecretPlaceholder")}
          />
        </Field>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
