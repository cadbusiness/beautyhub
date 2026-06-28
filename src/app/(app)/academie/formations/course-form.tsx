"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createCourse, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

const initial: ActionResult = {};

export function CourseForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("academie.courses.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(createCourse, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label={t("title")} htmlFor="title">
        <Input id="title" name="title" required placeholder={t("titlePlaceholder")} />
      </Field>
      <Field label={t("priceEur")} htmlFor="price">
        <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue="0" />
      </Field>
      <Field label={tCommon("description")} htmlFor="description">
        <Textarea id="description" name="description" placeholder={t("descriptionPlaceholder")} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_published" className="rounded border-slate-300" />
        {t("publishImmediately")}
      </label>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
