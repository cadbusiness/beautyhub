import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export interface BirthdayBonusResult {
  tenantId: string;
  credited: number;
  skipped: number;
}

function todayMonthDay(): { month: number; day: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, day: now.getDate(), year: now.getFullYear() };
}

/** Crédite le bonus anniversaire pour un institut (idempotent par année civile). */
export async function processBirthdayBonusesForTenant(
  supabase: Db,
  tenantId: string,
): Promise<BirthdayBonusResult> {
  const { month, day, year } = todayMonthDay();

  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, birthday_bonus_points, birthday_auto_enabled, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !program?.is_active ||
    !program.birthday_auto_enabled ||
    program.birthday_bonus_points <= 0
  ) {
    return { tenantId, credited: 0, skipped: 0 };
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, date_of_birth")
    .eq("tenant_id", tenantId)
    .not("date_of_birth", "is", null);

  let credited = 0;
  let skipped = 0;

  for (const client of clients ?? []) {
    if (!client.date_of_birth) continue;
    const dob = new Date(`${client.date_of_birth}T12:00:00`);
    if (dob.getMonth() + 1 !== month || dob.getDate() !== day) continue;

    const { data: balance } = await supabase
      .from("inst_loyalty_balances")
      .select("last_birthday_bonus_year")
      .eq("tenant_id", tenantId)
      .eq("client_id", client.id)
      .eq("program_id", program.id)
      .maybeSingle();

    if (balance?.last_birthday_bonus_year === year) {
      skipped += 1;
      continue;
    }

    const { data: ok } = await supabase.rpc("inst_loyalty_credit_bonus", {
      p_tenant_id: tenantId,
      p_client_id: client.id,
      p_program_id: program.id,
      p_points: program.birthday_bonus_points,
      p_source_type: "client_birthday",
      p_source_id: client.id,
      p_idempotency_key: `birthday:${year}:${client.id}`,
      p_notes: "Bonus anniversaire",
    });

    if (!ok) {
      skipped += 1;
      continue;
    }

    await supabase
      .from("inst_loyalty_balances")
      .update({ last_birthday_bonus_year: year })
      .eq("tenant_id", tenantId)
      .eq("client_id", client.id)
      .eq("program_id", program.id);

    credited += 1;
  }

  return { tenantId, credited, skipped };
}

/** Traite tous les instituts avec programme actif et bonus anniversaire auto. */
export async function processAllBirthdayBonuses(supabase: Db): Promise<BirthdayBonusResult[]> {
  const { data: programs } = await supabase
    .from("inst_loyalty_programs")
    .select("tenant_id")
    .eq("is_active", true)
    .eq("birthday_auto_enabled", true)
    .gt("birthday_bonus_points", 0);

  const tenantIds = [...new Set((programs ?? []).map((row) => row.tenant_id))];
  const results: BirthdayBonusResult[] = [];
  for (const tenantId of tenantIds) {
    results.push(await processBirthdayBonusesForTenant(supabase, tenantId));
  }
  return results;
}
