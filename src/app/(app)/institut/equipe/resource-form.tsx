"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createResource, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

export function ResourceForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("institut.team.cabines");
  const [state, action, pending] = useActionState(createResource, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label={t("form.name")} htmlFor="name">
        <Input id="name" name="name" required placeholder={t("form.namePlaceholder")} />
      </Field>
      <Field label={t("form.kind")} htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="cabin" className="!w-full">
          <option value="cabin">{t("kinds.cabin")}</option>
          <option value="event">{t("kinds.event")}</option>
        </Select>
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
