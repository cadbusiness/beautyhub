"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateTenant, type ActionResult } from "../../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function EditTenantForm({
  tenant,
}: {
  tenant: { id: string; name: string; slug: string };
}) {
  const t = useTranslations("admin.tenants.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(updateTenant, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenant.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tCommon("name")} htmlFor="name">
          <Input id="name" name="name" required defaultValue={tenant.name} />
        </Field>
        <Field label={t("slug")} htmlFor="slug">
          <Input id="slug" name="slug" required defaultValue={tenant.slug} />
        </Field>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}
