"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveWorkingHours, type ActionResult } from "../actions";
import { weekdayMessageKey } from "@/lib/i18n/nav";
import { WEEKDAYS } from "./constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";

const initial: ActionResult = {};

const timeInputClass = "!w-[7.25rem] shrink-0";

interface HourRow {
  weekday: number;
  start_time: string;
  end_time: string;
}

function DayRow({
  weekday,
  startTime,
  endTime,
  initiallyOpen,
  dayLabel,
  closedLabel,
}: {
  weekday: number;
  startTime: string;
  endTime: string;
  initiallyOpen: boolean;
  dayLabel: string;
  closedLabel: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <tr className={dataTableRow}>
      <td className={`font-medium text-slate-900 ${dataTableCell}`}>{dayLabel}</td>
      <td className={`text-center ${dataTableCell}`}>
        <input
          type="checkbox"
          name={`day_${weekday}`}
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
          className="size-4 rounded border-slate-300"
          aria-label={dayLabel}
        />
      </td>
      <td className={dataTableCell}>
        {!open ? (
          <span className="text-sm text-slate-400">{closedLabel}</span>
        ) : null}
        <div className={open ? "flex flex-wrap items-center gap-2" : "sr-only"}>
          <Input
            type="time"
            name={`start_${weekday}`}
            defaultValue={startTime}
            className={timeInputClass}
            tabIndex={open ? 0 : -1}
          />
          <span className="text-slate-400" aria-hidden>
            –
          </span>
          <Input
            type="time"
            name={`end_${weekday}`}
            defaultValue={endTime}
            className={timeInputClass}
            tabIndex={open ? 0 : -1}
          />
        </div>
      </td>
    </tr>
  );
}

export function WorkingHoursForm({ hours }: { hours: HourRow[] }) {
  const t = useTranslations("institut.team.horaires");
  const tWeekdays = useTranslations("weekdays");
  const [state, action, pending] = useActionState(saveWorkingHours, initial);
  const byDay = new Map(hours.map((h) => [h.weekday, h]));

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={`w-36 ${dataTableHead}`}>{t("columns.day")}</th>
              <th className={`w-24 text-center ${dataTableHead}`}>{t("columns.open")}</th>
              <th className={dataTableHead}>{t("columns.hours")}</th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day) => {
              const row = byDay.get(day.value);
              return (
                <DayRow
                  key={day.value}
                  weekday={day.value}
                  startTime={row?.start_time?.slice(0, 5) ?? "09:00"}
                  endTime={row?.end_time?.slice(0, 5) ?? "18:00"}
                  initiallyOpen={Boolean(row)}
                  dayLabel={tWeekdays(weekdayMessageKey(day.value))}
                  closedLabel={t("closed")}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{t("saved")}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
