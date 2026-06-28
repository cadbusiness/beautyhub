/** Fuseau métier BeautyHub (instituts BE/FR). */
export const APP_TIME_ZONE = "Europe/Paris";

/** Date calendaire du jour (YYYY-MM-DD) dans le fuseau métier. */
export function todayDateString(timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Interprète YYYY-MM-DD comme jour calendaire (midi UTC, stable SSR/client). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}
