import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export interface PublicOpeningHoursRow {
  weekday: number;
  start_time: string;
  end_time: string;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type WeekdayMessageKey = (typeof WEEKDAY_KEYS)[number];

export function weekdayMessageKey(weekday: number): WeekdayMessageKey {
  return WEEKDAY_KEYS[weekday] ?? "mon";
}

export async function fetchPublicOpeningHours(
  supabase: Db,
  tenantId: string,
): Promise<PublicOpeningHoursRow[]> {
  const { data } = await supabase.rpc("get_public_opening_hours", { p_tenant_id: tenantId });
  return (data ?? []) as PublicOpeningHoursRow[];
}

export function groupOpeningHoursByWeekday(
  rows: PublicOpeningHoursRow[],
): Map<number, PublicOpeningHoursRow[]> {
  const map = new Map<number, PublicOpeningHoursRow[]>();
  for (const row of rows) {
    const list = map.get(row.weekday) ?? [];
    list.push(row);
    map.set(row.weekday, list);
  }
  return map;
}

export function formatTimeLabel(time: string): string {
  return time.slice(0, 5);
}
