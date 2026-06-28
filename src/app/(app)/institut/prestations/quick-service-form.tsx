"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createService, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function QuickServiceForm({
  onCreated,
  compact = false,
}: {
  onCreated?: (serviceId: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations("institut.services.quickForm");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [state, action, pending] = useActionState(createService, initial);

  useEffect(() => {
    if (state.ok && state.serviceId) {
      onCreated?.(state.serviceId);
      router.refresh();
    }
  }, [state.ok, state.serviceId, onCreated, router]);

  return (
    <form
      action={action}
      className={
        compact
          ? "space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"
          : "space-y-3 rounded-lg border border-slate-200 p-4"
      }
    >
      <p className="text-sm font-medium text-slate-900">{t("title")}</p>
      <input type="hidden" name="visibility" value="catalog" />
      <input type="hidden" name="is_active" value="on" />
      <input type="hidden" name="extras_links_json" value="[]" />
      <div className={compact ? "grid gap-3 sm:grid-cols-3" : "space-y-3"}>
        <Field label={t("name")} htmlFor="qs-name">
          <Input id="qs-name" name="name" required placeholder={t("namePlaceholder")} className="!w-full" />
        </Field>
        <Field label={t("duration")} htmlFor="qs-duration">
          <Input
            id="qs-duration"
            name="duration_min"
            type="number"
            min={5}
            step={5}
            defaultValue={60}
            required
            className="!w-full"
          />
        </Field>
        <Field label={t("price")} htmlFor="qs-price">
          <Input
            id="qs-price"
            name="price"
            type="number"
            min={0}
            step={0.01}
            defaultValue={0}
            required
            className="!w-full"
          />
        </Field>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-9">
        {pending ? tCommon("saving") : t("submit")}
      </Button>
    </form>
  );
}
