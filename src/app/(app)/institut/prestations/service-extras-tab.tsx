"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  loadServiceExtraLinks,
  saveServiceExtras,
  type ServiceExtraLinkInput,
} from "./extras-actions";
import type { ServiceRow } from "./service-dialog";

export function ServiceExtrasTab({
  service,
  candidateServices,
}: {
  service: ServiceRow;
  candidateServices: ServiceRow[];
}) {
  const t = useTranslations("institut.services.dialog.extras");
  const tCommon = useTranslations("common");
  const [links, setLinks] = useState<ServiceExtraLinkInput[]>([]);
  const [stepPosition, setStepPosition] = useState<"before_time" | "after_time">(
    (service.extras_step_position === "before_time" ? "before_time" : "after_time"),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadServiceExtraLinks(service.id).then((rows) => {
      setLinks(rows);
      setStepPosition(
        service.extras_step_position === "before_time" ? "before_time" : "after_time",
      );
    });
  }, [service.id, service.extras_step_position]);

  const available = candidateServices.filter((s) => s.id !== service.id && s.is_active);

  function toggleExtra(extraId: string) {
    setLinks((prev) => {
      const exists = prev.find((l) => l.extra_service_id === extraId);
      if (exists) return prev.filter((l) => l.extra_service_id !== extraId);
      return [
        ...prev,
        {
          extra_service_id: extraId,
          min_qty: 0,
          max_qty: 1,
          sort_order: prev.length,
        },
      ];
    });
  }

  function updateLink(extraId: string, patch: Partial<ServiceExtraLinkInput>) {
    setLinks((prev) =>
      prev.map((l) => (l.extra_service_id === extraId ? { ...l, ...patch } : l)),
    );
  }

  function handleSave() {
    startTransition(async () => {
      setError(null);
      const res = await saveServiceExtras(service.id, links, stepPosition);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("hint")}</p>

      <Field label={t("stepPosition")} htmlFor="extras_step_position">
        <select
          id="extras_step_position"
          value={stepPosition}
          onChange={(e) =>
            setStepPosition(e.target.value as "before_time" | "after_time")
          }
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="before_time">{t("beforeTime")}</option>
          <option value="after_time">{t("afterTime")}</option>
        </select>
      </Field>

      {available.length === 0 ? (
        <p className="text-sm text-slate-500">{t("noCandidates")}</p>
      ) : (
        <ul className="space-y-2">
          {available.map((s) => {
            const link = links.find((l) => l.extra_service_id === s.id);
            const checked = Boolean(link);
            return (
              <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggleExtra(s.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{s.name}</span>
                      {s.visibility === "extra_only" ? (
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-700">
                          {t("extraOnlyBadge")}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-slate-500">
                      {s.duration_min} min · {(s.price_cents / 100).toFixed(2)} €
                    </span>
                  </span>
                </label>
                {checked && link ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 pl-7">
                    <Field label={t("minQty")} htmlFor={`min-${s.id}`}>
                      <Input
                        id={`min-${s.id}`}
                        type="number"
                        min={0}
                        max={link.max_qty}
                        value={link.min_qty}
                        onChange={(e) =>
                          updateLink(s.id, {
                            min_qty: Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </Field>
                    <Field label={t("maxQty")} htmlFor={`max-${s.id}`}>
                      <Input
                        id={`max-${s.id}`}
                        type="number"
                        min={1}
                        value={link.max_qty}
                        onChange={(e) =>
                          updateLink(s.id, {
                            max_qty: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                          })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="button" disabled={pending} onClick={handleSave}>
        {pending ? tCommon("saving") : t("saveExtras")}
      </Button>
    </div>
  );
}
