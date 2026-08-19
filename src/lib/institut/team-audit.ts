import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { logAuditEvent } from "@/lib/compliance/audit";

type Db = SupabaseClient<Database>;

export type TeamAuditActor = {
  userId: string;
  email: string | null;
  tenant: { id: string };
};

export async function logInstitutAudit(
  supabase: Db,
  actor: TeamAuditActor,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await logAuditEvent(supabase, {
    tenantId: actor.tenant.id,
    actorType: "team",
    actorId: actor.userId,
    actorEmail: actor.email,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata,
  });
}

export type TeamAuditLogRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
};

export async function fetchTeamAuditLogs(
  supabase: Db,
  tenantId: string,
  limit = 200,
): Promise<TeamAuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, created_at, actor_email, actor_id, action, resource_type, resource_id, metadata",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[audit] fetch", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    actor_email: row.actor_email,
    actor_id: row.actor_id,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  }));
}
