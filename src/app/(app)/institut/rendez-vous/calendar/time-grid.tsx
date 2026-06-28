"use client";

import { useTranslations } from "next-intl";
import type { CalendarAppointment } from "./types";
import { HOUR_END, HOUR_START, SLOT_MINUTES, SLOT_PX } from "./types";
import { gridHeightPx, slotCount } from "./utils";
import { AppointmentBlock } from "./appointment-block";

export type ColumnKind = "staff" | "resource" | "day";

export interface TimeGridColumn {
  id: string;
  label: string;
  color?: string | null;
}

export interface SlotClickPayload {
  columnId: string;
  slotIndex: number;
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
  onSlotClick,
  movePending,
}: {
  columns: TimeGridColumn[];
  columnKind: ColumnKind;
  appointments: CalendarAppointment[];
  matchColumn: (appt: CalendarAppointment, columnId: string) => boolean;
  onSelect: (appt: CalendarAppointment, el: HTMLElement) => void;
  onMove: (payload: MovePayload) => void;
  onSlotClick?: (payload: SlotClickPayload) => void;
  movePending?: boolean;
}) {
  const t = useTranslations("appointments.calendar");
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
              <button
                key={i}
                type="button"
                title={onSlotClick ? t("slotClickHint") : undefined}
                disabled={!onSlotClick || movePending}
                onClick={() => onSlotClick?.({ columnId: col.id, slotIndex: i })}
                className={cnSlotBorder(i, Boolean(onSlotClick))}
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

function cnSlotBorder(index: number, clickable: boolean): string {
  const minuteSlot = index % (60 / SLOT_MINUTES);
  const border =
    minuteSlot === 0 ? "border-b border-slate-200" : "border-b border-slate-100/80";
  if (!clickable) return `block w-full ${border}`;
  return [
    "block w-full",
    border,
    "cursor-pointer transition-colors hover:bg-slate-100/90 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-slate-300",
  ].join(" ");
}
