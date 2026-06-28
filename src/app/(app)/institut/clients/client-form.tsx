"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createClientRecord, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function ClientForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("institut.clients.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(createClientRecord, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label={t("fullName")} htmlFor="full_name">
        <Input id="full_name" name="full_name" placeholder={t("fullNamePlaceholder")} />
      </Field>
      <Field label={tCommon("email")} htmlFor="email">
        <Input id="email" name="email" type="email" required placeholder={t("emailPlaceholder")} />
      </Field>
      <Field label={tCommon("phone")} htmlFor="phone">
        <Input id="phone" name="phone" placeholder={t("phonePlaceholder")} />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
