"use client";

import { useActionState } from "react";
import { createTenant, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

export function CreateTenantForm({
  plans,
}: {
  plans: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createTenant, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'institut" htmlFor="name">
          <Input id="name" name="name" required placeholder="Institut Beaute Lyon" />
        </Field>
        <Field label="Identifiant (sous-domaine)" htmlFor="slug">
          <Input id="slug" name="slug" placeholder="beaute-lyon" />
        </Field>
      </div>

      <Field label="Formule" htmlFor="plan_id">
        <Select id="plan_id" name="plan_id" defaultValue="">
          <option value="">— Aucune pour l&apos;instant —</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-2 text-sm text-slate-500">
          Compte proprietaire (optionnel)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="owner_email">
            <Input id="owner_email" name="owner_email" type="email" placeholder="proprio@institut.fr" />
          </Field>
          <Field label="Mot de passe" htmlFor="owner_password">
            <Input id="owner_password" name="owner_password" type="text" placeholder="min. 6 caracteres" />
          </Field>
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-amber-600">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creation..." : "Creer l'institut"}
      </Button>
    </form>
  );
}
