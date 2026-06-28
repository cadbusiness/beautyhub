import type { CalendarViewMode } from "./types";
import { HOUR_END, HOUR_START, SLOT_MINUTES, SLOT_PX } from "./types";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}

export function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTimeShort(startsAt)} – ${formatTimeShort(endsAt)}`;
}

export function apptBlockStyle(
  startsAt: string,
  endsAt: string,
): { top: number; height: number } {
  const start = minutesFromMidnight(startsAt);
  const end = minutesFromMidnight(endsAt);
  const gridStart = HOUR_START * 60;
  const pxPerMin = SLOT_PX / SLOT_MINUTES;
  const top = (start - gridStart) * pxPerMin;
  const height = Math.max((end - start) * pxPerMin, SLOT_PX);
  return { top, height };
}

export function gridHeightPx(): number {
  return ((HOUR_END - HOUR_START) * 60 / SLOT_MINUTES) * SLOT_PX;
}

export function slotCount(): number {
  return ((HOUR_END - HOUR_START) * 60) / SLOT_MINUTES;
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

export function minutesToIso(baseDay: Date, minutes: number): string {
  const d = new Date(baseDay);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
}

export function getRangeForView(anchor: Date, view: CalendarViewMode): { start: Date; end: Date } {
  if (view === "day") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  const monthStart = startOfMonth(anchor);
  const start = addDays(monthStart, -7);
  const end = addDays(endOfMonth(anchor), 7);
  return { start, end };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function accentColor(appt: { service?: { color?: string | null } | null }): string {
  return appt.service?.color ?? "#64748b";
}
