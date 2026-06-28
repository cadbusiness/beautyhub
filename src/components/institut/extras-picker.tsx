"use client";

import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/utils";
import type { BookingExtraLine, ServiceExtraConfig } from "@/lib/institut/service-extras";
import { totalDurationMin, totalPriceCents } from "@/lib/institut/service-extras";

export function ExtrasPicker({
  catalog,
  baseDurationMin,
  basePriceCents,
  value,
  onChange,
}: {
  catalog: ServiceExtraConfig[];
  baseDurationMin: number;
  basePriceCents: number;
  value: BookingExtraLine[];
  onChange: (next: BookingExtraLine[]) => void;
}) {
  const t = useTranslations("institut.extras");

  if (catalog.length === 0) return null;

  function qtyFor(serviceId: string): number {
    return value.find((v) => v.service_id === serviceId)?.quantity ?? 0;
  }

  function setQty(serviceId: string, quantity: number, min: number, max: number) {
    const clamped = Math.max(min, Math.min(max, quantity));
    const rest = value.filter((v) => v.service_id !== serviceId);
    if (clamped > 0) {
      onChange([...rest, { service_id: serviceId, quantity: clamped }]);
    } else {
      onChange(rest);
    }
  }

  const totalMin = totalDurationMin(baseDurationMin, value, catalog);
  const totalPrice = totalPriceCents(basePriceCents, value, catalog);

  return (
    <div className="space-y-3">
      {catalog.map((extra) => {
        const qty = qtyFor(extra.extra_service_id);
        return (
          <div
            key={extra.extra_service_id}
            className="flex gap-3 rounded-lg border border-slate-200 p-3"
          >
            {extra.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={extra.image_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                {t("noImage")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{extra.name}</p>
              {extra.description ? (
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{extra.description}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {t("lineMeta", {
                  min: extra.duration_min,
                  price: formatPrice(extra.price_cents),
                })}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  disabled={qty <= extra.min_qty}
                  onClick={() => setQty(extra.extra_service_id, qty - 1, extra.min_qty, extra.max_qty)}
                  aria-label={t("decrease")}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  disabled={qty >= extra.max_qty}
                  onClick={() => setQty(extra.extra_service_id, qty + 1, extra.min_qty, extra.max_qty)}
                  aria-label={t("increase")}
                >
                  +
                </button>
                {extra.min_qty > 0 ? (
                  <span className="text-xs text-slate-400">
                    {t("requiredMin", { min: extra.min_qty, max: extra.max_qty })}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    {t("optionalMax", { max: extra.max_qty })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-sm text-slate-600">
        {t("total", {
          min: totalMin,
          price: formatPrice(totalPrice),
        })}
      </p>
    </div>
  );
}
