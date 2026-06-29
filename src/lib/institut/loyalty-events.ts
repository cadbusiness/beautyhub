import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

/** Points parrainage : crédite la cliente parrainante après la première visite de la filleule. */
export async function creditReferralBonus(
  supabase: Db,
  tenantId: string,
  referrerClientId: string,
  referredClientId: string,
): Promise<boolean> {
  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, referral_points, is_active")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!program?.is_active || program.referral_points <= 0) return false;

  const { data: ok } = await supabase.rpc("inst_loyalty_credit_bonus", {
    p_tenant_id: tenantId,
    p_client_id: referrerClientId,
    p_program_id: program.id,
    p_points: program.referral_points,
    p_source_type: "referral_completed",
    p_source_id: referredClientId,
    p_idempotency_key: `referral:${referrerClientId}:${referredClientId}`,
    p_notes: "Parrainage",
  });

  return Boolean(ok);
}

/** Bonus rebooking le jour même : après une vente ou un RDV terminé, si un nouveau RDV est pris le même jour. */
export async function creditSameDayRebookBonus(
  supabase: Db,
  tenantId: string,
  clientId: string,
  triggerAppointmentId: string,
  newAppointmentId: string,
): Promise<boolean> {
  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, same_day_rebook_points, is_active")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!program?.is_active || program.same_day_rebook_points <= 0) return false;

  const { data: ok } = await supabase.rpc("inst_loyalty_credit_bonus", {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_program_id: program.id,
    p_points: program.same_day_rebook_points,
    p_source_type: "same_day_rebook",
    p_source_id: newAppointmentId,
    p_idempotency_key: `rebook:${triggerAppointmentId}:${newAppointmentId}`,
    p_notes: "Rebooking jour même",
  });

  return Boolean(ok);
}
