"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createStaffMember, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function StaffForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("institut.team.personnel.form");
  const [state, action, pending] = useActionState(createStaffMember, initial);
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
        <Input id="full_name" name="full_name" required placeholder={t("fullNamePlaceholder")} />
      </Field>
      <Field label={t("emailOptional")} htmlFor="email">
        <Input id="email" name="email" type="email" placeholder={t("emailPlaceholder")} />
      </Field>
      <Field label={t("colorOptional")} htmlFor="color">
        <Input id="color" name="color" type="color" defaultValue="#64748b" className="h-10 w-16 p-1" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
