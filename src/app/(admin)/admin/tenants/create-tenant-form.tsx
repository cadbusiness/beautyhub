"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createTenant, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

export function CreateTenantForm({
  plans,
  onSuccess,
}: {
  plans: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("admin.tenants.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(createTenant, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} htmlFor="name">
          <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
        </Field>
        <Field label={t("slug")} htmlFor="slug">
          <Input id="slug" name="slug" placeholder={t("slugPlaceholder")} />
        </Field>
      </div>

      <Field label={t("plan")} htmlFor="plan_id">
        <Select id="plan_id" name="plan_id" defaultValue="">
          <option value="">{t("noPlan")}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-2 text-sm text-slate-500">{t("ownerLegend")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tCommon("email")} htmlFor="owner_email">
            <Input
              id="owner_email"
              name="owner_email"
              type="email"
              placeholder={t("ownerEmailPlaceholder")}
            />
          </Field>
          <Field label={tCommon("password")} htmlFor="owner_password">
            <Input
              id="owner_password"
              name="owner_password"
              type="text"
              placeholder={t("ownerPasswordPlaceholder")}
            />
          </Field>
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-amber-600">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
