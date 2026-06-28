"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { updateTeamProfile, type AccountActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: AccountActionResult = {};

export function AccountProfileForm({
  email,
  fullName,
  phone,
}: {
  email: string;
  fullName: string;
  phone: string;
}) {
  const t = useTranslations("account.profile");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(updateTeamProfile, initial);

  useEffect(() => {
    if (state.ok) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.ok]);

  return (
    <form action={action} className="space-y-4">
      <Field label={tCommon("email")} htmlFor="email">
        <Input id="email" name="email" value={email} disabled className="bg-slate-50" />
      </Field>

      <Field label={t("fullName")} htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          placeholder={t("fullNamePlaceholder")}
          autoComplete="name"
        />
      </Field>

      <Field label={tCommon("phone")} htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder={t("phonePlaceholder")}
          autoComplete="tel"
        />
      </Field>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok && state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}
