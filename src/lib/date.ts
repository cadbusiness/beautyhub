/** Fuseau métier BeautyHub (instituts BE/FR). */
export const APP_TIME_ZONE = "Europe/Paris";

/** Date calendaire (YYYY-MM-DD) d'un instant dans le fuseau métier. */
export function calendarDateString(
  date: Date | string = new Date(),
  timeZone = APP_TIME_ZONE,
): string {
  const instant = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Date calendaire du jour (YYYY-MM-DD) dans le fuseau métier. */
export function todayDateString(timeZone = APP_TIME_ZONE): string {
  return calendarDateString(new Date(), timeZone);
}

/** Interprète YYYY-MM-DD comme jour calendaire (midi UTC, stable SSR/client). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Ajoute des jours à une date calendaire YYYY-MM-DD (indépendant du DST). */
export function addCalendarDays(ymd: string, days: number): string {
  const d = parseDateOnly(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Offset `wallClock(tz) - utc` à un instant donné.
 * Gère hour=24 (minuit) renvoyé par certains moteurs.
 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  let hour = n("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    hour,
    n("minute"),
    n("second"),
  );
  return asUtc - date.getTime();
}

/** Instant UTC correspondant à une heure murale dans `timeZone` le jour `ymd`. */
export function zonedDateTimeUtc(
  ymd: string,
  hour: number,
  minute = 0,
  timeZone = APP_TIME_ZONE,
): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
  const first = new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone));
  return new Date(utcGuess - timeZoneOffsetMs(first, timeZone));
}

/** `YYYY-MM-DDTHH:mm` dans le fuseau métier, pour un input datetime-local. */
export function toDateTimeLocalValue(
  iso: string | Date,
  timeZone = APP_TIME_ZONE,
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${n("year")}-${n("month")}-${n("day")}T${n("hour")}:${n("minute")}`;
}

/** Interprète une saisie de clôture (`YYYY-MM-DDTHH:mm` ou ISO). */
export function parseClosedAtInput(value: string | null | undefined): Date | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(trimmed);
  if (local) {
    return zonedDateTimeUtc(local[1], Number(local[2]), Number(local[3]));
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Instant UTC correspondant à 00:00:00 dans `timeZone` le jour `ymd`. */
export function zonedDayStartUtc(ymd: string, timeZone = APP_TIME_ZONE): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const first = new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone));
  return new Date(utcGuess - timeZoneOffsetMs(first, timeZone));
}

/** Bornes UTC d'un jour calendaire (end exclusive = minuit du lendemain). */
export function zonedDayBoundsUtc(
  ymd: string,
  timeZone = APP_TIME_ZONE,
): { start: Date; endExclusive: Date } {
  const start = zonedDayStartUtc(ymd, timeZone);
  const endExclusive = zonedDayStartUtc(addCalendarDays(ymd, 1), timeZone);
  return { start, endExclusive };
}

export function isYmd(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/** True si `iso` tombe sur un jour calendaire strictement avant aujourd'hui. */
export function isPreviousCalendarDay(
  iso: string,
  timeZone = APP_TIME_ZONE,
): boolean {
  return calendarDateString(iso, timeZone) < todayDateString(timeZone);
}

export type HistoryPeriod = "today" | "yesterday" | "week" | "all";

export function parseHistoryPeriod(value: string | null | undefined): HistoryPeriod {
  if (value === "yesterday" || value === "week" || value === "all") return value;
  return "today";
}

/** Fenêtre UTC inclusive-start / exclusive-end pour un filtre de période caisse. */
export function historyPeriodBoundsUtc(
  period: HistoryPeriod,
  timeZone = APP_TIME_ZONE,
  now = new Date(),
): { start: Date; endExclusive: Date } | null {
  const today = calendarDateString(now, timeZone);
  if (period === "all") return null;
  if (period === "today") {
    return zonedDayBoundsUtc(today, timeZone);
  }
  if (period === "yesterday") {
    return zonedDayBoundsUtc(addCalendarDays(today, -1), timeZone);
  }
  return {
    start: zonedDayStartUtc(addCalendarDays(today, -6), timeZone),
    endExclusive: zonedDayStartUtc(addCalendarDays(today, 1), timeZone),
  };
}
