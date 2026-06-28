"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  AppointmentCreateDraft,
  CalendarAppointment,
  CalendarColumn,
  ColumnMode,
} from "./types";
import { addDays, isSameDay, startOfDay, startOfWeek } from "./utils";
import { TimeGrid, type SlotClickPayload } from "./time-grid";
import { HOUR_START, SLOT_MINUTES } from "./types";
import { minutesToIso } from "./utils";

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
  onSlotClick,
  movePending,
}: {
  anchor: Date;
  columnMode: ColumnMode;
  columns: CalendarColumn[];
  appointments: CalendarAppointment[];
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMove: (payload: MovePayload) => void;
  onSlotClick?: (draft: AppointmentCreateDraft) => void;
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

  function handleSlotClick({ columnId, slotIndex }: SlotClickPayload) {
    if (!onSlotClick) return;
    const minutes = HOUR_START * 60 + slotIndex * SLOT_MINUTES;
    onSlotClick({
      startsAt: minutesToIso(baseDay, minutes),
      staffId: columnMode === "staff" ? columnId : null,
      resourceId: columnMode === "resource" ? columnId : null,
    });
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
      onSlotClick={onSlotClick ? handleSlotClick : undefined}
      movePending={movePending}
    />
  );
}

export function WeekView({
  anchor,
  appointments,
  onSelect,
  onMove,
  onSlotClick,
  movePending,
}: {
  anchor: Date;
  appointments: CalendarAppointment[];
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMove: (payload: MovePayload) => void;
  onSlotClick?: (draft: AppointmentCreateDraft) => void;
  movePending?: boolean;
}) {
  const format = useFormatter();
  const weekStart = startOfWeek(anchor);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const columns = days.map((d) => ({
    id: d.toISOString(),
    label: format.dateTime(d, { weekday: "short", day: "numeric" }),
  }));

  const weekAppts = useMemo(
    () =>
      appointments.filter((a) => {
        const t = new Date(a.starts_at);
        return t >= weekStart && t < addDays(weekStart, 7);
      }),
    [appointments, weekStart],
  );

  function handleSlotClick({ columnId, slotIndex }: SlotClickPayload) {
    if (!onSlotClick) return;
    const minutes = HOUR_START * 60 + slotIndex * SLOT_MINUTES;
    const day = startOfDay(new Date(columnId));
    onSlotClick({ startsAt: minutesToIso(day, minutes) });
  }

  return (
    <TimeGrid
      columns={columns}
      columnKind="day"
      appointments={weekAppts}
      matchColumn={(a, colId) => isSameDay(new Date(a.starts_at), new Date(colId))}
      onSelect={onSelect}
      onMove={onMove}
      onSlotClick={onSlotClick ? handleSlotClick : undefined}
      movePending={movePending}
    />
  );
}
