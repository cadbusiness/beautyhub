import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

function todayBounds(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

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
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
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
  triggerSourceId: string,
  newAppointmentId: string,
): Promise<boolean> {
  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, same_day_rebook_points, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program?.is_active || program.same_day_rebook_points <= 0) return false;

  const { data: ok } = await supabase.rpc("inst_loyalty_credit_bonus", {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_program_id: program.id,
    p_points: program.same_day_rebook_points,
    p_source_type: "same_day_rebook",
    p_source_id: newAppointmentId,
    p_idempotency_key: `rebook:${triggerSourceId}:${newAppointmentId}`,
    p_notes: "Rebooking jour même",
  });

  return Boolean(ok);
}

async function findSameDayRebookTrigger(
  supabase: Db,
  tenantId: string,
  clientId: string,
  excludeAppointmentId: string,
): Promise<string | null> {
  const { start, end } = todayBounds();

  const { data: sale } = await supabase
    .from("inst_sales")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "paid")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sale?.id) return sale.id;

  const { data: appt } = await supabase
    .from("inst_appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "completed")
    .neq("id", excludeAppointmentId)
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return appt?.id ?? null;
}

/** Crédite le parrain à la première visite terminée de la filleule. */
export async function processReferralOnFirstCompletedVisit(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<void> {
  const { data: client } = await supabase
    .from("clients")
    .select("referred_by_client_id")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  const referrerId = client?.referred_by_client_id;
  if (!referrerId || referrerId === clientId) return;

  const { count } = await supabase
    .from("inst_appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "completed");

  if ((count ?? 0) !== 1) return;

  await creditReferralBonus(supabase, tenantId, referrerId, clientId);
}

/** Crédite le bonus rebooking si la cliente reprend RDV le jour même. */
export async function processSameDayRebookOnNewAppointment(
  supabase: Db,
  tenantId: string,
  clientId: string,
  newAppointmentId: string,
): Promise<void> {
  const triggerId = await findSameDayRebookTrigger(
    supabase,
    tenantId,
    clientId,
    newAppointmentId,
  );
  if (!triggerId) return;

  await creditSameDayRebookBonus(
    supabase,
    tenantId,
    clientId,
    triggerId,
    newAppointmentId,
  );
}
