import type { CalendarAppointment, CalendarViewMode } from "./types";
import { HOUR_END, HOUR_START, SLOT_MINUTES, SLOT_PX } from "./types";

export { parseDateOnly, todayDateString } from "@/lib/date";

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

export function accentColor(appt: {
  staff?: { color?: string | null } | null;
  service?: { color?: string | null } | null;
}): string {
  return appt.staff?.color ?? appt.service?.color ?? "#64748b";
}

function parseHex(input: string): { r: number; g: number; b: number } | null {
  const hex = input.trim().replace(/^#/, "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

/** Fond très pâle dérivé d'une couleur hex (fallback gris si parse KO). */
export function pastelBackground(hex: string, opacity = 0.16): string {
  const rgb = parseHex(hex);
  if (!rgb) return "rgba(148, 163, 184, 0.12)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/** Couleur de texte lisible sur un fond pastel dérivé de `hex`. */
export function pastelForeground(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#0f172a";
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < 96 ? "#0f172a" : "#0f172a";
}

export type OverlapLayout = {
  appt: CalendarAppointment;
  laneIndex: number;
  laneCount: number;
};

/**
 * Place appointments in parallel lanes when they overlap in time.
 * Groups appointments that share any overlap into a "cluster", then assigns
 * each appt to the lowest available lane inside its cluster. Every appt of
 * the same cluster gets the same laneCount so blocks share the column width.
 */
export function computeOverlapLayout(appts: CalendarAppointment[]): OverlapLayout[] {
  if (appts.length === 0) return [];
  const items = appts
    .map((a, idx) => ({
      appt: a,
      idx,
      start: new Date(a.starts_at).getTime(),
      end: new Date(a.ends_at).getTime(),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const clusters: (typeof items)[] = [];
  let current: typeof items = [];
  let currentEnd = -Infinity;

  for (const it of items) {
    if (current.length === 0 || it.start < currentEnd) {
      current.push(it);
      currentEnd = Math.max(currentEnd, it.end);
    } else {
      clusters.push(current);
      current = [it];
      currentEnd = it.end;
    }
  }
  if (current.length) clusters.push(current);

  const result: OverlapLayout[] = [];
  for (const cluster of clusters) {
    const laneEnd: number[] = [];
    const assign: { item: (typeof items)[number]; lane: number }[] = [];
    for (const it of cluster) {
      let lane = laneEnd.findIndex((end) => end <= it.start);
      if (lane === -1) {
        lane = laneEnd.length;
        laneEnd.push(it.end);
      } else {
        laneEnd[lane] = it.end;
      }
      assign.push({ item: it, lane });
    }
    const laneCount = laneEnd.length;
    for (const a of assign) {
      result.push({ appt: a.item.appt, laneIndex: a.lane, laneCount });
    }
  }
  return result;
}
