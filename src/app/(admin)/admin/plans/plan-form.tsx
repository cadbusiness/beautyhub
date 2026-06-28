"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { savePlan, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

const LIMIT_KEYS = [
  "limitStaff",
  "limitClients",
  "limitAppointments",
  "limitStudents",
] as const;

const LIMIT_FIELD_KEYS = ["staff", "clients", "appointments_per_month", "students"] as const;

const FEATURE_KEYS = [
  "featureCalendar",
  "featureClientBooking",
  "featureSms",
] as const;

const FEATURE_FIELD_KEYS = [
  "calendar_enabled",
  "client_booking_enabled",
  "sms_enabled",
] as const;

export interface PlanDefaults {
  id?: string;
  name?: string;
  price_cents?: number;
  interval?: string;
  is_active?: boolean;
  modules?: string[];
  limits?: Record<string, number | null>;
  features?: Record<string, boolean>;
}

export function PlanForm({
  plan,
  modules,
  onSuccess,
}: {
  plan?: PlanDefaults;
  modules: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("admin.plans.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(savePlan, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const selected = new Set(plan?.modules ?? []);
  const features = plan?.features ?? {};

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {plan?.id ? <input type="hidden" name="plan_id" value={plan.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Field label={tCommon("name")} htmlFor="name">
            <Input
              id="name"
              name="name"
              required
              defaultValue={plan?.name}
              placeholder={t("namePlaceholder")}
            />
          </Field>
        </div>
        <Field label={t("priceEur")} htmlFor="price">
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={plan ? (plan.price_cents ?? 0) / 100 : ""}
            placeholder={t("pricePlaceholder")}
          />
        </Field>
        <Field label={t("interval")} htmlFor="interval">
          <Select id="interval" name="interval" defaultValue={plan?.interval ?? "month"}>
            <option value="month">{t("monthly")}</option>
            <option value="year">{t("yearly")}</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">{t("includedModules")}</p>
        <div className="flex flex-wrap gap-3">
          {modules.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
        <p className="mb-2 text-sm font-medium text-slate-700">{t("rdvFeatures")}</p>
        <div className="flex flex-wrap gap-3">
          {FEATURE_KEYS.map((key, i) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name={`feature_${FEATURE_FIELD_KEYS[i]}`}
                defaultChecked={features[FEATURE_FIELD_KEYS[i]] !== false}
              />
              {t(key)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          {t("quotas")} <span className="text-xs text-slate-400">{t("quotasHint")}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          {LIMIT_KEYS.map((labelKey, i) => {
            const fieldKey = LIMIT_FIELD_KEYS[i];
            const v = plan?.limits?.[fieldKey];
            return (
              <Field key={fieldKey} label={t(labelKey)} htmlFor={`limit_${fieldKey}`}>
                <Input
                  id={`limit_${fieldKey}`}
                  name={`limit_${fieldKey}`}
                  type="number"
                  min="0"
                  defaultValue={typeof v === "number" ? v : ""}
                  placeholder={t("unlimitedPlaceholder")}
                />
              </Field>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked={plan?.is_active ?? true} />
        {t("isActive")}
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : plan?.id ? t("editSubmit") : t("createSubmit")}
      </Button>
    </form>
  );
}
