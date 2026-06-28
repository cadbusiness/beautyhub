"use client";

import { useTranslations } from "next-intl";
import {
  DEFAULT_AVAILABILITY,
  WEEKDAY_ORDER,
  type AvailabilityPreferences,
} from "@/lib/public/booking-availability";
import { Field, Input } from "@/components/ui/input";

export function defaultAvailability(): AvailabilityPreferences {
  return {
    ...DEFAULT_AVAILABILITY,
    fromDate: new Date().toISOString().slice(0, 10),
  };
}

export function AvailabilityPreferencesForm({
  value,
  onChange,
  variant = "inline",
}: {
  value: AvailabilityPreferences;
  onChange: (next: AvailabilityPreferences) => void;
  variant?: "inline" | "card";
}) {
  const t = useTranslations("public.booking.availability");

  function toggleWeekday(day: number) {
    const has = value.weekdays.includes(day);
    const weekdays = has
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day].sort((a, b) => a - b);
    onChange({ ...value, weekdays });
  }

  const timeInvalid =
    value.timeFrom &&
    value.timeTo &&
    value.timeFrom >= value.timeTo;

  const wrapperClass =
    variant === "card"
      ? "space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4"
      : "space-y-4 border-t border-slate-200 pt-4";

  return (
    <div className={wrapperClass}>
      {variant === "card" ? (
        <>
          <p className="text-sm font-medium text-slate-900">{t("title")}</p>
          <p className="text-xs text-slate-500">{t("hint")}</p>
        </>
      ) : (
        <p className="text-sm text-slate-600">{t("hint")}</p>
      )}

      <Field label={t("fromDate")} htmlFor="avail_from">
        <Input
          id="avail_from"
          type="date"
          value={value.fromDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange({ ...value, fromDate: e.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("weekdays")}
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_ORDER.map((day) => {
            const active = value.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWeekday(day)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {t(`dayShort.${day}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("timeFrom")} htmlFor="avail_from_time">
          <Input
            id="avail_from_time"
            type="time"
            value={value.timeFrom}
            onChange={(e) => onChange({ ...value, timeFrom: e.target.value })}
          />
        </Field>
        <Field label={t("timeTo")} htmlFor="avail_to_time">
          <Input
            id="avail_to_time"
            type="time"
            value={value.timeTo}
            onChange={(e) => onChange({ ...value, timeTo: e.target.value })}
          />
        </Field>
      </div>

      {timeInvalid ? (
        <p className="text-xs text-red-600">{t("timeInvalid")}</p>
      ) : null}
      {value.weekdays.length === 0 ? (
        <p className="text-xs text-red-600">{t("weekdaysRequired")}</p>
      ) : null}
    </div>
  );
}
