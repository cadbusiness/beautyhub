export const RECURRENCE_FREQUENCIES = ["none", "weekly", "biweekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const MAX_RECURRENCE_OCCURRENCES = 52;

export function isRecurrenceFrequency(value: string): value is RecurrenceFrequency {
  return (RECURRENCE_FREQUENCIES as readonly string[]).includes(value);
}

export function dateKeyLocal(d: Date, timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addMonthsKeepingDay(source: Date, months: number): Date {
  const next = new Date(source.getTime());
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/** Occurrences locales à la même heure, bornées par untilDate (YYYY-MM-DD) et un plafond. */
export function occurrenceStarts(
  first: Date,
  frequency: RecurrenceFrequency,
  untilDate: string | null,
): Date[] {
  if (frequency === "none" || !untilDate) return [new Date(first.getTime())];

  const out: Date[] = [new Date(first.getTime())];
  let cursor = new Date(first.getTime());

  while (out.length < MAX_RECURRENCE_OCCURRENCES) {
    if (frequency === "weekly") {
      cursor = new Date(cursor.getTime());
      cursor.setDate(cursor.getDate() + 7);
    } else if (frequency === "biweekly") {
      cursor = new Date(cursor.getTime());
      cursor.setDate(cursor.getDate() + 14);
    } else {
      cursor = addMonthsKeepingDay(cursor, 1);
    }
    if (dateKeyLocal(cursor) > untilDate) break;
    out.push(new Date(cursor.getTime()));
  }

  return out;
}

export function defaultUntilDate(from: Date, frequency: RecurrenceFrequency): string {
  const until = new Date(from.getTime());
  if (frequency === "monthly") until.setMonth(until.getMonth() + 6);
  else until.setMonth(until.getMonth() + 3);
  return dateKeyLocal(until);
}
