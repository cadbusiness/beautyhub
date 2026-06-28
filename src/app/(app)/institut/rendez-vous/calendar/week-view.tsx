"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CalendarAppointment, CalendarColumn, ColumnMode } from "./types";
import { addDays, isSameDay, startOfDay, startOfWeek } from "./utils";
import { TimeGrid } from "./time-grid";

type MovePayload = {
  id: string;
  starts_at: string;
  ends_at: string;
  staff_id?: string | null;
  resource_id?: string | null;
};

export function DayView({
  anchor,
  columnMode,
  columns,
  appointments,
  onSelect,
  onMove,
  movePending,
}: {
  anchor: Date;
  columnMode: ColumnMode;
  columns: CalendarColumn[];
  appointments: CalendarAppointment[];
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMove: (payload: MovePayload) => void;
  movePending?: boolean;
}) {
  const t = useTranslations("appointments.calendar");
  const baseDay = startOfDay(anchor);
  const dayAppts = useMemo(
    () => appointments.filter((a) => isSameDay(new Date(a.starts_at), baseDay)),
    [appointments, baseDay],
  );

  if (columns.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-slate-500 lg:px-6">
        {columnMode === "staff"
          ? t("emptyStaff")
          : t("emptyResources")}
      </p>
    );
  }

  return (
    <TimeGrid
      columns={columns}
      columnKind={columnMode}
      appointments={dayAppts}
      matchColumn={(a, colId) =>
        columnMode === "staff" ? a.staff_id === colId : a.resource_id === colId
      }
      onSelect={onSelect}
      onMove={onMove}
      movePending={movePending}
    />
  );
}

export function WeekView({
  anchor,
  appointments,
  onSelect,
  onMove,
  movePending,
}: {
  anchor: Date;
  appointments: CalendarAppointment[];
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMove: (payload: MovePayload) => void;
  movePending?: boolean;
}) {
  const weekStart = startOfWeek(anchor);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const columns = days.map((d) => ({
    id: d.toISOString(),
    label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
  }));

  const weekAppts = useMemo(
    () =>
      appointments.filter((a) => {
        const t = new Date(a.starts_at);
        return t >= weekStart && t < addDays(weekStart, 7);
      }),
    [appointments, weekStart],
  );

  return (
    <TimeGrid
      columns={columns}
      columnKind="day"
      appointments={weekAppts}
      matchColumn={(a, colId) => isSameDay(new Date(a.starts_at), new Date(colId))}
      onSelect={onSelect}
      onMove={onMove}
      movePending={movePending}
    />
  );
}
