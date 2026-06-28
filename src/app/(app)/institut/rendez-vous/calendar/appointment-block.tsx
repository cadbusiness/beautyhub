"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CalendarAppointment } from "./types";
import type { ColumnKind } from "./time-grid";
import {
  accentColor,
  apptBlockStyle,
  minutesFromMidnight,
  snapMinutes,
  startOfDay,
} from "./utils";
import { HOUR_START, SLOT_MINUTES, SLOT_PX } from "./types";

const VALID_STATUSES = [
  "booked",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

type MovePayload = {
  id: string;
  starts_at: string;
  ends_at: string;
  staff_id?: string | null;
  resource_id?: string | null;
};

export function AppointmentBlock({
  appt,
  columnId,
  columnKind,
  onSelect,
  onMoveEnd,
  disabled,
}: {
  appt: CalendarAppointment;
  columnId: string;
  columnKind: ColumnKind;
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMoveEnd?: (payload: MovePayload) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const tStatus = useTranslations("appointments.status");
  const format = useFormatter();
  const { top, height } = apptBlockStyle(appt.starts_at, appt.ends_at);
  const color = accentColor(appt);
  const cancelled = appt.status === "cancelled";
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origStartMin: number;
    durationMin: number;
  } | null>(null);
  const [dragTop, setDragTop] = useState<number | null>(null);

  const displayTop = dragTop ?? top;
  const showDetails = height >= SLOT_PX * 3;
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

  function resolveTargetColumn(clientX: number, clientY: number): string {
    const hit = document
      .elementFromPoint(clientX, clientY)
      ?.closest("[data-column-id]");
    return hit?.getAttribute("data-column-id") ?? columnId;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || cancelled) return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origStartMin: minutesFromMidnight(appt.starts_at),
      durationMin: minutesFromMidnight(appt.ends_at) - minutesFromMidnight(appt.starts_at),
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaY = e.clientY - drag.startY;
    const pxPerMin = SLOT_PX / SLOT_MINUTES;
    const deltaMin = snapMinutes(deltaY / pxPerMin);
    const newStart = snapMinutes(
      Math.max(HOUR_START * 60, drag.origStartMin + deltaMin),
    );
    const gridStart = HOUR_START * 60;
    setDragTop((newStart - gridStart) * pxPerMin);
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragTop(null);

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
      onSelect(appt, e.currentTarget);
      return;
    }

    const targetColumnId = resolveTargetColumn(e.clientX, e.clientY);
    let baseDay = startOfDay(new Date(appt.starts_at));
    if (columnKind === "day" && targetColumnId !== columnId) {
      baseDay = startOfDay(new Date(targetColumnId));
    }

    const pxPerMin = SLOT_PX / SLOT_MINUTES;
    const deltaMin = snapMinutes(deltaY / pxPerMin);
    const newStartMin = snapMinutes(
      Math.max(HOUR_START * 60, drag.origStartMin + deltaMin),
    );
    const newEndMin = newStartMin + drag.durationMin;

    const startDate = new Date(baseDay);
    startDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);
    const endDate = new Date(baseDay);
    endDate.setHours(Math.floor(newEndMin / 60), newEndMin % 60, 0, 0);

    const payload: MovePayload = {
      id: appt.id,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
    };

    if (columnKind === "staff") {
      payload.staff_id = targetColumnId;
    } else if (columnKind === "resource") {
      payload.resource_id = targetColumnId;
    }

    onMoveEnd?.(payload);
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragTop(null);
      }}
      className={cn(
        "absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
        cancelled && "opacity-50",
        dragTop !== null && "z-20 ring-2 ring-slate-400",
      )}
      style={{
        top: displayTop,
        height,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      <p className="truncate font-medium text-slate-900">{timeRange}</p>
      <p className="truncate text-slate-800">{appt.service?.name ?? t("appointmentShort")}</p>
      {showDetails ? (
        <>
          <p className="truncate text-slate-600">
            {appt.client?.full_name ?? appt.client?.email ?? t("noClient")}
          </p>
          <p className="truncate text-[10px] text-slate-500">{statusLabel}</p>
        </>
      ) : null}
    </button>
  );
}
