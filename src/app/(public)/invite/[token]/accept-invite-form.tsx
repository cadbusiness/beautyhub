"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { acceptTeamInvitation, type InviteResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: InviteResult = {};

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("invite");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(acceptTeamInvitation, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label={tCommon("email")} htmlFor="email">
        <Input id="email" name="email" type="email" readOnly defaultValue={email} />
      </Field>
      <Field label={t("fullName")} htmlFor="full_name">
        <Input id="full_name" name="full_name" required />
      </Field>
      <Field label={tCommon("password")} htmlFor="password">
        <Input id="password" name="password" type="password" required minLength={8} />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
