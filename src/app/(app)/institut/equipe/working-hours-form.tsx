"use client";

import { useActionState } from "react";
import { saveWorkingHours, type ActionResult } from "../actions";
import { WEEKDAYS } from "./constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: ActionResult = {};

interface HourRow {
  weekday: number;
  start_time: string;
  end_time: string;
}

export function WorkingHoursForm({ hours }: { hours: HourRow[] }) {
  const [state, action, pending] = useActionState(saveWorkingHours, initial);
  const byDay = new Map(hours.map((h) => [h.weekday, h]));

  return (
    <form action={action} className="space-y-3">
      {WEEKDAYS.map((day) => {
        const row = byDay.get(day.value);
        const enabled = Boolean(row);
        return (
          <div
            key={day.value}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
          >
            <label className="flex w-28 items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                name={`day_${day.value}`}
                defaultChecked={enabled}
                className="rounded"
              />
              {day.label}
            </label>
            <Input
              type="time"
              name={`start_${day.value}`}
              defaultValue={row?.start_time?.slice(0, 5) ?? "09:00"}
              className="w-32"
            />
            <span className="text-sm text-slate-400">→</span>
            <Input
              type="time"
              name={`end_${day.value}`}
              defaultValue={row?.end_time?.slice(0, 5) ?? "18:00"}
              className="w-32"
            />
          </div>
        );
      })}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Horaires enregistres.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer les horaires"}
      </Button>
    </form>
  );
}
