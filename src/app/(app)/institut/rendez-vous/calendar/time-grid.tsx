"use client";

import type { CalendarAppointment } from "./types";

export type ColumnKind = "staff" | "resource" | "day";
import { HOUR_END, HOUR_START, SLOT_MINUTES, SLOT_PX } from "./types";
import { gridHeightPx, slotCount } from "./utils";
import { AppointmentBlock } from "./appointment-block";

export interface TimeGridColumn {
  id: string;
  label: string;
  color?: string | null;
}

type MovePayload = {
  id: string;
  starts_at: string;
  ends_at: string;
  staff_id?: string | null;
  resource_id?: string | null;
};

export function TimeGrid({
  columns,
  columnKind,
  appointments,
  matchColumn,
  onSelect,
  onMove,
  movePending,
}: {
  columns: TimeGridColumn[];
  columnKind: ColumnKind;
  appointments: CalendarAppointment[];
  matchColumn: (appt: CalendarAppointment, columnId: string) => boolean;
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMove: (payload: MovePayload) => void;
  movePending?: boolean;
}) {
  const slots = slotCount();
  const height = gridHeightPx();

  return (
    <div className="overflow-x-auto border-t border-slate-200">
      <div
        className="grid min-w-max bg-slate-50/50"
        style={{
          gridTemplateColumns: `56px repeat(${columns.length}, minmax(150px, 1fr))`,
        }}
      >
        <div className="border-b border-r border-slate-200 bg-slate-50" />
        {columns.map((c) => (
          <div
            key={c.id}
            className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm font-medium text-slate-800"
          >
            {c.color ? (
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: c.color }}
              />
            ) : null}
            {c.label}
          </div>
        ))}

        <div className="relative border-r border-slate-200 bg-white">
          {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((h) => (
            <div
              key={h}
              className="border-b border-slate-100 pr-1 text-right text-[10px] text-slate-400"
              style={{ height: (60 / SLOT_MINUTES) * SLOT_PX }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {columns.map((col) => (
          <div
            key={col.id}
            data-column-id={col.id}
            className="relative border-r border-slate-200 bg-white"
            style={{ height }}
          >
            {Array.from({ length: slots }, (_, i) => (
              <div
                key={i}
                className={cnSlotBorder(i)}
                style={{ height: SLOT_PX }}
              />
            ))}
            {appointments
              .filter((a) => matchColumn(a, col.id))
              .map((a) => (
                <AppointmentBlock
                  key={a.id}
                  appt={a}
                  columnId={col.id}
                  columnKind={columnKind}
                  onSelect={onSelect}
                  onMoveEnd={onMove}
                  disabled={movePending}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function cnSlotBorder(index: number): string {
  const minuteSlot = index % (60 / SLOT_MINUTES);
  return minuteSlot === 0
    ? "border-b border-slate-200"
    : "border-b border-slate-100/80";
}
