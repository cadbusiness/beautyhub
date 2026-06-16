import { createClient } from "@/lib/supabase/server";
import { decryptCredentials } from "./crypto";

export type ConnectionScope = "platform" | "brand" | "tenant";

export interface ResolvedConnection {
  scopeType: ConnectionScope;
  scopeId: string | null;
  provider: string;
  status: "connected" | "disconnected";
  config: Record<string, unknown>;
  credentials: Record<string, unknown> | null;
}

/**
 * Resout une integration pour un tenant en cascade: tenant -> brand -> plateforme.
 * Renvoie la premiere connexion "connected" trouvee (credentials dechiffres).
 */
export async function resolveConnection(
  tenantId: string,
  provider: string,
): Promise<ResolvedConnection | null> {
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("brand_id")
    .eq("id", tenantId)
    .maybeSingle();

  const candidates: Array<{ scope_type: ConnectionScope; scope_id: string | null }> = [
    { scope_type: "tenant", scope_id: tenantId },
  ];
  if (tenant?.brand_id) {
    candidates.push({ scope_type: "brand", scope_id: tenant.brand_id });
  }
  candidates.push({ scope_type: "platform", scope_id: null });

  for (const c of candidates) {
    let query = supabase
      .from("connections")
      .select("scope_type, scope_id, provider, status, config, credentials")
      .eq("provider", provider)
      .eq("scope_type", c.scope_type)
      .eq("status", "connected");
    query = c.scope_id
      ? query.eq("scope_id", c.scope_id)
      : query.is("scope_id", null);

    const { data } = await query.maybeSingle();
    if (data) {
      return {
        scopeType: data.scope_type as ConnectionScope,
        scopeId: data.scope_id,
        provider: data.provider,
        status: data.status as "connected" | "disconnected",
        config: (data.config as Record<string, unknown>) ?? {},
        credentials: decryptCredentials(
          (data.credentials as { enc?: string }) ?? {},
        ),
      };
    }
  }

  return null;
}
