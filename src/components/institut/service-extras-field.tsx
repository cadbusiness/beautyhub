"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ExtrasPicker } from "@/components/institut/extras-picker";
import {
  defaultExtrasFromCatalog,
  type BookingExtraLine,
  type ServiceExtraConfig,
} from "@/lib/institut/service-extras";

export function ServiceExtrasField({
  serviceId,
  baseDurationMin,
  basePriceCents,
  value,
  onChange,
  seedFromCatalog = false,
  compact = false,
}: {
  serviceId: string;
  baseDurationMin: number;
  basePriceCents: number;
  value: BookingExtraLine[];
  onChange: (next: BookingExtraLine[]) => void;
  seedFromCatalog?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("appointments.form");
  const [catalog, setCatalog] = useState<ServiceExtraConfig[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [, startLoad] = useTransition();

  useEffect(() => {
    if (!serviceId) {
      setCatalog([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    startLoad(async () => {
      try {
        const res = await fetch(
          `/api/institut/service-extras?serviceId=${encodeURIComponent(serviceId)}`,
        );
        if (!res.ok) throw new Error("load_failed");
        const next = (await res.json()) as ServiceExtraConfig[];
        if (cancelled) return;
        setCatalog(next);
        setStatus("ok");
        const defaults = defaultExtrasFromCatalog(next);
        if (seedFromCatalog) {
          onChange(defaults);
        } else if (defaults.length > 0 && value.length === 0) {
          onChange(defaults);
        }
      } catch {
        if (!cancelled) {
          setCatalog([]);
          setStatus("error");
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // Intentionally omit onChange: parent recreates it each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, seedFromCatalog]);

  if (!serviceId) return null;
  if (status === "loading") {
    return <p className="text-xs text-slate-500">{t("extrasLoading")}</p>;
  }
  if (status === "error") {
    return <p className="text-xs text-red-600">{t("extrasError")}</p>;
  }
  if (catalog.length === 0) {
    return <p className="text-xs text-slate-400">{t("extrasEmpty")}</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-900">{t("extras")}</p>
      <ExtrasPicker
        catalog={catalog}
        baseDurationMin={baseDurationMin}
        basePriceCents={basePriceCents}
        value={value}
        onChange={onChange}
        compact={compact}
      />
    </div>
  );
}
