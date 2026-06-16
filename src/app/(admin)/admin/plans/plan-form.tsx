"use client";

import { useActionState } from "react";
import { savePlan, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

const LIMIT_FIELDS: { key: string; label: string }[] = [
  { key: "staff", label: "Membres d'equipe" },
  { key: "clients", label: "Fiches clients" },
  { key: "appointments_per_month", label: "RDV / mois" },
  { key: "students", label: "Eleves (academie)" },
];

export interface PlanDefaults {
  id?: string;
  name?: string;
  price_cents?: number;
  interval?: string;
  is_active?: boolean;
  modules?: string[];
  limits?: Record<string, number | null>;
}

export function PlanForm({
  plan,
  modules,
}: {
  plan?: PlanDefaults;
  modules: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(savePlan, initial);
  const selected = new Set(plan?.modules ?? []);

  return (
    <form action={action} className="space-y-5">
      {plan?.id ? <input type="hidden" name="plan_id" value={plan.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Field label="Nom" htmlFor="name">
            <Input id="name" name="name" required defaultValue={plan?.name} placeholder="Pro" />
          </Field>
        </div>
        <Field label="Prix (EUR)" htmlFor="price">
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={plan ? (plan.price_cents ?? 0) / 100 : ""}
            placeholder="59"
          />
        </Field>
        <Field label="Periodicite" htmlFor="interval">
          <Select id="interval" name="interval" defaultValue={plan?.interval ?? "month"}>
            <option value="month">Mensuel</option>
            <option value="year">Annuel</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Modules inclus
        </p>
        <div className="flex flex-wrap gap-3">
          {modules.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
            >
              <input
                type="checkbox"
                name="modules"
                value={m.id}
                defaultChecked={selected.has(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Quotas <span className="text-xs text-slate-400">(vide = illimite)</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          {LIMIT_FIELDS.map((f) => {
            const v = plan?.limits?.[f.key];
            return (
              <Field key={f.key} label={f.label} htmlFor={`limit_${f.key}`}>
                <Input
                  id={`limit_${f.key}`}
                  name={`limit_${f.key}`}
                  type="number"
                  min="0"
                  defaultValue={typeof v === "number" ? v : ""}
                  placeholder="∞"
                />
              </Field>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" name="is_active" defaultChecked={plan?.is_active ?? true} />
        Formule active (proposable aux instituts)
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : plan?.id ? "Enregistrer" : "Creer la formule"}
      </Button>
    </form>
  );
}
