import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { BookingExtraLine } from "@/lib/institut/service-extras";
import { fetchPublicSlots, type PublicSlot } from "@/lib/public/booking-load";

type Db = SupabaseClient<Database>;

export interface AvailabilityPreferences {
  fromDate: string;
  /** 0 = dimanche … 6 = samedi (convention JS Date.getDay) */
  weekdays: number[];
  timeFrom: string;
  timeTo: string;
}

export const DEFAULT_AVAILABILITY: AvailabilityPreferences = {
  fromDate: new Date().toISOString().slice(0, 10),
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  timeFrom: "09:00",
  timeTo: "18:00",
};

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const MAX_SEARCH_DAYS = 60;
const MAX_SLOTS_RETURN = 48;
const FETCH_BATCH_SIZE = 8;

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((part) => Number.parseInt(part, 10));
  return (h || 0) * 60 + (m || 0);
}

function slotLocalMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function matchesTimeWindow(iso: string, timeFrom: string, timeTo: string): boolean {
  const mins = slotLocalMinutes(iso);
  return mins >= parseTimeToMinutes(timeFrom) && mins <= parseTimeToMinutes(timeTo);
}

export function isAvailabilityValid(prefs: AvailabilityPreferences): boolean {
  if (!prefs.fromDate || prefs.weekdays.length === 0) return false;
  return parseTimeToMinutes(prefs.timeFrom) < parseTimeToMinutes(prefs.timeTo);
}

function datesMatchingWeekdays(fromDate: string, weekdays: number[]): string[] {
  const dates: string[] = [];
  const start = new Date(`${fromDate}T12:00:00`);
  for (let offset = 0; offset < MAX_SEARCH_DAYS; offset += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    if (weekdays.includes(d.getDay())) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupSlotsByDate(slots: PublicSlot[]): [string, PublicSlot[]][] {
  const map = new Map<string, PublicSlot[]>();
  for (const slot of slots) {
    const key = localDateKey(slot.starts_at);
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export async function fetchPublicSlotsMatchingAvailability(
  supabase: Db,
  tenantId: string,
  serviceId: string,
  staffId: string | undefined,
  extras: BookingExtraLine[],
  prefs: AvailabilityPreferences,
): Promise<PublicSlot[]> {
  const dates = datesMatchingWeekdays(prefs.fromDate, prefs.weekdays);
  const matched: PublicSlot[] = [];

  for (let i = 0; i < dates.length; i += FETCH_BATCH_SIZE) {
    const batch = dates.slice(i, i + FETCH_BATCH_SIZE);
    const batches = await Promise.all(
      batch.map((date) =>
        fetchPublicSlots(supabase, tenantId, serviceId, date, staffId, extras),
      ),
    );

    for (const daySlots of batches) {
      for (const slot of daySlots) {
        if (matchesTimeWindow(slot.starts_at, prefs.timeFrom, prefs.timeTo)) {
          matched.push(slot);
          if (matched.length >= MAX_SLOTS_RETURN) {
            return matched.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          }
        }
      }
    }
  }

  return matched.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
