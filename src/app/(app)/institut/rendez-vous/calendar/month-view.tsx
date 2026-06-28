"use client";

import { cn } from "@/lib/utils";
import type { CalendarAppointment } from "./types";
import { addDays, isSameDay, startOfMonth, startOfWeek } from "./utils";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function MonthView({
  anchor,
  appointments,
  onSelectDay,
}: {
  anchor: Date;
  appointments: CalendarAppointment[];
  onSelectDay: (day: Date) => void;
}) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(gridStart, i));
  }

  function countForDay(day: Date): number {
    return appointments.filter((a) => isSameDay(new Date(a.starts_at), day)).length;
  }

  return (
    <div className="border-t border-slate-200 p-4 lg:p-6">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-slate-50 px-2 py-2 text-center text-xs font-medium uppercase text-slate-500"
          >
            {label}
          </div>
        ))}
        {cells.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const count = countForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-24 bg-white p-2 text-left transition-colors hover:bg-slate-50",
                !inMonth && "bg-slate-50/80 text-slate-400",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                  isToday && "bg-slate-900 font-semibold text-white",
                )}
              >
                {day.getDate()}
              </span>
              {count > 0 ? (
                <p className="mt-2 text-xs text-slate-600">{count} RDV</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
