"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateTeamPassword, type AccountActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: AccountActionResult = {};

export function AccountPasswordForm() {
  const t = useTranslations("account.password");
  const [state, action, pending] = useActionState(updateTeamPassword, initial);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("newPassword")} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t("confirmPassword")} htmlFor="password_confirm">
          <Input
            id="password_confirm"
            name="password_confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok && state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
