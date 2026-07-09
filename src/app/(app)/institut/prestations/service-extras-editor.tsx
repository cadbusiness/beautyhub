"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination";
import { paginateItems } from "@/lib/ui/pagination";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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

  const available = useMemo(
    () =>
      candidateServices.filter(
        (s) => s.is_active && s.visibility === "extra_only" && (!serviceId || s.id !== serviceId),
      ),
    [candidateServices, serviceId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((s) => s.name.toLowerCase().includes(q));
  }, [available, search]);

  const slice = useMemo(() => paginateItems(filtered, page), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > slice.totalPages) setPage(slice.totalPages);
  }, [page, slice.totalPages]);

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
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t("hint")}</p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">{t("stepPosition")}</span>
        <select
          id="extras_step_position"
          value={stepPosition}
          onChange={(e) => onStepPositionChange(e.target.value as ExtrasStepPosition)}
          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="before_time">{t("beforeTime")}</option>
          <option value="after_time">{t("afterTime")}</option>
        </select>
      </label>

      {available.length === 0 ? (
        <p className="text-sm text-slate-500">{t("noCandidates")}</p>
      ) : (
        <div className="space-y-2">
          {available.length > 5 ? (
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9"
            />
          ) : null}

          {filtered.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">{t("noSearchResults")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <ul className="divide-y divide-slate-100">
                {slice.items.map((s) => {
                  const link = links.find((l) => l.extra_service_id === s.id);
                  const checked = Boolean(link);
                  return (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="shrink-0"
                          checked={checked}
                          onChange={() => toggleExtra(s.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                          {s.name}
                        </span>
                        {s.visibility === "extra_only" ? (
                          <span className="shrink-0 rounded bg-violet-50 px-1 py-0.5 text-[10px] font-medium uppercase text-violet-700">
                            {t("extraOnlyBadge")}
                          </span>
                        ) : null}
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          {s.duration_min} min · {(s.price_cents / 100).toFixed(2)} €
                        </span>
                      </label>
                      {checked && link ? (
                        <div className="flex items-center gap-2 border-t border-slate-50 bg-slate-50/80 px-2 py-1.5 pl-8">
                          <span className="text-[11px] text-slate-500">{t("minQty")}</span>
                          <input
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
                            className="h-7 w-12 rounded border border-slate-300 bg-white px-1.5 text-xs tabular-nums"
                          />
                          <span className="text-[11px] text-slate-500">{t("maxQty")}</span>
                          <input
                            id={`max-${s.id}`}
                            type="number"
                            min={1}
                            value={link.max_qty}
                            onChange={(e) =>
                              updateLink(s.id, {
                                max_qty: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="h-7 w-12 rounded border border-slate-300 bg-white px-1.5 text-xs tabular-nums"
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <PaginationBar
                page={slice.page}
                totalPages={slice.totalPages}
                from={slice.from}
                to={slice.to}
                total={slice.total}
                onPageChange={setPage}
              />
            </div>
          )}

          {links.length > 0 ? (
            <p className="text-xs text-slate-500">
              {t("selectedCount", { count: links.length })}
            </p>
          ) : null}
        </div>
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
