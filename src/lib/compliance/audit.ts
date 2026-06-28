import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getRequestMeta } from "./request-meta";

type Db = SupabaseClient<Database>;

export type AuditActorType = "team" | "client" | "system" | "anonymous";

export type AuditEventInput = {
  tenantId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAuditEvent(
  supabase: Db,
  input: AuditEventInput,
): Promise<void> {
  const meta =
    input.ipAddress !== undefined
      ? { ipAddress: input.ipAddress, userAgent: input.userAgent ?? null }
      : await getRequestMeta();

  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: input.tenantId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    metadata: (input.metadata ?? {}) as Database["public"]["Tables"]["audit_logs"]["Insert"]["metadata"],
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
  });

  if (error) {
    console.error("[audit]", error.message);
  }
}
