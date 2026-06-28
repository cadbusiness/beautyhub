"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { clientLogin, type ClientAuthResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const initial: ClientAuthResult = {};

export default function ClientLoginPage() {
  const t = useTranslations("public.client.login");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(clientLogin, initial);

  return (
    <Card className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-500">{t("subtitle")}</p>
      <form action={action} className="space-y-4">
        <Field label={tCommon("email")} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={tCommon("password")} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500">
        {t("noAccount")}{" "}
        <Link href="/client/inscription" className="text-slate-900 underline">
          {t("createAccount")}
        </Link>
      </p>
    </Card>
  );
}
