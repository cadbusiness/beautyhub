"use client";

import { useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CalendarAppointment } from "./types";

const VALID_STATUSES = [
  "booked",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export function AppointmentPopover({
  appt,
  anchorRect,
  onClose,
  onEdit,
  onCancel,
  pending,
}: {
  appt: CalendarAppointment;
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("common");
  const tStatus = useTranslations("appointments.status");
  const format = useFormatter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 320);
  const left = Math.min(anchorRect.left, window.innerWidth - 340);
  const timeRange = `${format.dateTime(new Date(appt.starts_at), {
    hour: "2-digit",
    minute: "2-digit",
  })} – ${format.dateTime(new Date(appt.ends_at), {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const statusLabel = VALID_STATUSES.includes(appt.status as (typeof VALID_STATUSES)[number])
    ? tStatus(appt.status as (typeof VALID_STATUSES)[number])
    : appt.status;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label={t("close")}
        onClick={onClose}
      />
      <div
        ref={ref}
        className="fixed z-50 w-[min(100vw-2rem,320px)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        style={{ top, left }}
      >
        <div className="mb-3 border-b border-slate-100 pb-3">
          <p className="font-semibold text-slate-900">
            {appt.service?.name ?? t("appointment")}
          </p>
          <p className="mt-1 text-sm text-slate-600">{timeRange}</p>
          <p className="text-xs text-slate-400">
            {format.dateTime(new Date(appt.starts_at), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400">{t("client")}</dt>
            <dd className="text-slate-900">
              {appt.client?.full_name ?? appt.client?.email ?? t("noClient")}
            </dd>
            {appt.client?.phone ? (
              <dd className="text-slate-600">{appt.client.phone}</dd>
            ) : null}
            {appt.client?.email ? (
              <dd className="text-slate-500">{appt.client.email}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-slate-400">{t("practitioner")}</dt>
            <dd className="text-slate-900">{appt.staff?.full_name ?? t("dash")}</dd>
          </div>
          {appt.resource?.name ? (
            <div>
              <dt className="text-xs text-slate-400">{t("cabin")}</dt>
              <dd className="text-slate-900">{appt.resource.name}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {statusLabel}
            </span>
            {appt.price_cents != null ? (
              <span className="text-sm font-medium tabular-nums text-slate-900">
                {format.number(appt.price_cents / 100, {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
            ) : null}
          </div>
        </dl>
        <div className="mt-4 flex gap-2">
          <Button type="button" className="h-9 flex-1" onClick={onEdit} disabled={pending}>
            {t("edit")}
          </Button>
          {appt.status !== "cancelled" ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 text-red-600"
              onClick={onCancel}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
