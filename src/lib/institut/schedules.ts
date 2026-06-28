import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export interface ScheduleBlock {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface ScheduleRow {
  id: string;
  name: string;
  is_default: boolean;
}

/** Blocs horaires effectifs d'un praticien (grille assignee ou defaut institut). */
export async function fetchStaffScheduleBlocks(
  supabase: Db,
  tenantId: string,
  staffId: string | null,
  weekday: number,
): Promise<ScheduleBlock[]> {
  if (!staffId) {
    const { data: def } = await supabase
      .from("inst_schedules")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();
    if (!def) return [];
    const { data } = await supabase
      .from("inst_schedule_blocks")
      .select("weekday, start_time, end_time")
      .eq("schedule_id", def.id)
      .eq("weekday", weekday)
      .order("start_time");
    return (data ?? []).map((b) => ({
      weekday: b.weekday,
      start_time: b.start_time,
      end_time: b.end_time,
    }));
  }

  const { data: staff } = await supabase
    .from("inst_staff")
    .select("schedule_id")
    .eq("id", staffId)
    .maybeSingle();

  let scheduleId = staff?.schedule_id ?? null;
  if (!scheduleId) {
    const { data: def } = await supabase
      .from("inst_schedules")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();
    scheduleId = def?.id ?? null;
  }
  if (!scheduleId) return [];

  const { data } = await supabase
    .from("inst_schedule_blocks")
    .select("weekday, start_time, end_time")
    .eq("schedule_id", scheduleId)
    .eq("weekday", weekday)
    .order("start_time");

  return (data ?? []).map((b) => ({
    weekday: b.weekday,
    start_time: b.start_time,
    end_time: b.end_time,
  }));
}

/** Tous les blocs d'une grille. */
export async function fetchScheduleBlocks(
  supabase: Db,
  scheduleId: string,
): Promise<ScheduleBlock[]> {
  const { data } = await supabase
    .from("inst_schedule_blocks")
    .select("weekday, start_time, end_time")
    .eq("schedule_id", scheduleId)
    .order("weekday")
    .order("start_time");

  return (data ?? []).map((b) => ({
    weekday: b.weekday,
    start_time: b.start_time,
    end_time: b.end_time,
  }));
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** Valide qu'un RDV tombe dans au moins une plage horaire. */
export function validateAgainstBlocks(
  blocks: ScheduleBlock[],
  weekday: number,
  startsAt: Date,
  endsAt: Date,
): boolean {
  const dayBlocks = blocks.filter((b) => b.weekday === weekday);
  if (dayBlocks.length === 0) return false;

  const startMin = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMin = endsAt.getHours() * 60 + endsAt.getMinutes();

  return dayBlocks.some((w) => {
    const wStart = parseTimeToMinutes(w.start_time);
    const wEnd = parseTimeToMinutes(w.end_time);
    return startMin >= wStart && endMin <= wEnd;
  });
}

export function parseBlocksJson(raw: string): ScheduleBlock[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const blocks: ScheduleBlock[] = [];
    for (const item of parsed) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as ScheduleBlock).weekday !== "number" ||
        typeof (item as ScheduleBlock).start_time !== "string" ||
        typeof (item as ScheduleBlock).end_time !== "string"
      ) {
        return null;
      }
      const b = item as ScheduleBlock;
      if (b.weekday < 0 || b.weekday > 6 || b.start_time >= b.end_time) return null;
      blocks.push({
        weekday: b.weekday,
        start_time: b.start_time.slice(0, 5),
        end_time: b.end_time.slice(0, 5),
      });
    }
    return blocks;
  } catch {
    return null;
  }
}
