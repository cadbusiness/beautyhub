import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getRequestMeta } from "./request-meta";

type Db = SupabaseClient<Database>;

export type ConsentType = "marketing" | "terms" | "privacy";
export type ConsentActorType = "client" | "staff" | "system";

export async function recordConsentEvent(
  supabase: Db,
  input: {
    tenantId: string;
    clientId: string;
    consentType: ConsentType;
    granted: boolean;
    source: string;
    actorType: ConsentActorType;
    actorId?: string | null;
    ipAddress?: string | null;
  },
): Promise<void> {
  const meta =
    input.ipAddress !== undefined
      ? { ipAddress: input.ipAddress }
      : await getRequestMeta();

  const { error } = await supabase.from("consent_events").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    consent_type: input.consentType,
    granted: input.granted,
    source: input.source,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    ip_address: meta.ipAddress,
  });

  if (error) {
    console.error("[consent]", error.message);
  }
}
