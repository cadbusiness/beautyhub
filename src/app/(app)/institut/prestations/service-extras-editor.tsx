"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveServiceExtras } from "./extras-actions";
import type { ServiceExtraLinkInput } from "@/lib/institut/service-extras-persist";
import type { ServiceRow } from "./service-dialog";

export type ExtrasStepPosition = "before_time" | "after_time";

export function ServiceExtrasEditor({
  serviceId,
  candidateServices,
  links,
  onLinksChange,
  stepPosition,
  onStepPositionChange,
  showSaveButton = false,
}: {
  serviceId?: string;
  candidateServices: ServiceRow[];
  links: ServiceExtraLinkInput[];
  onLinksChange: (links: ServiceExtraLinkInput[]) => void;
  stepPosition: ExtrasStepPosition;
  onStepPositionChange: (pos: ExtrasStepPosition) => void;
  showSaveButton?: boolean;
}) {
  const t = useTranslations("institut.services.dialog.extras");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    fetch(`/api/institut/service-extra-links?serviceId=${encodeURIComponent(serviceId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load_failed"))))
      .then((data: ServiceExtraLinkInput[]) => {
        if (!cancelled) onLinksChange(data);
      })
      .catch(() => {
        if (!cancelled) onLinksChange([]);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, onLinksChange]);

  const available = candidateServices.filter(
    (s) => s.is_active && (!serviceId || s.id !== serviceId),
  );

  function toggleExtra(extraId: string) {
    const exists = links.find((l) => l.extra_service_id === extraId);
    if (exists) {
      onLinksChange(links.filter((l) => l.extra_service_id !== extraId));
    } else {
      onLinksChange([
        ...links,
        {
          extra_service_id: extraId,
          min_qty: 0,
          max_qty: 1,
          sort_order: links.length,
        },
      ]);
    }
  }

  function updateLink(extraId: string, patch: Partial<ServiceExtraLinkInput>) {
    onLinksChange(
      links.map((l) => (l.extra_service_id === extraId ? { ...l, ...patch } : l)),
    );
  }

  function handleSave() {
    if (!serviceId) return;
    startTransition(async () => {
      setError(null);
      const res = await saveServiceExtras(serviceId, links, stepPosition);
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
            onStepPositionChange(e.target.value as ExtrasStepPosition)
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

      {showSaveButton && serviceId ? (
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? tCommon("saving") : t("saveExtras")}
        </Button>
      ) : null}
    </div>
  );
}
