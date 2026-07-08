import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/db/database.types";
import { decryptCredentials, encryptCredentials } from "./crypto";

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

/** Statut d'une connexion tenant (sans dechiffrer les credentials). */
export async function getTenantConnectionStatus(
  tenantId: string,
  provider: string,
): Promise<{ status: "connected" | "disconnected"; config: Record<string, unknown> } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connections")
    .select("status, config")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as "connected" | "disconnected",
    config: (data.config as Record<string, unknown>) ?? {},
  };
}

/** Cree ou met a jour une connexion tenant avec credentials chiffres. */
export async function saveTenantConnection(
  tenantId: string,
  provider: string,
  credentials: Record<string, unknown>,
  config: Record<string, unknown> = {},
  status: "connected" | "disconnected" = "connected",
): Promise<void> {
  const supabase = await createClient();
  const enc = encryptCredentials(credentials);

  const { data: existing } = await supabase
    .from("connections")
    .select("id")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("connections")
      .update({ credentials: enc as Json, config: config as Json, status })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("connections").insert({
      scope_type: "tenant",
      scope_id: tenantId,
      provider,
      credentials: enc as Json,
      config: config as Json,
      status,
    });
    if (error) throw new Error(error.message);
  }
}

/** Met à jour uniquement le config d'une connexion tenant (sans toucher aux credentials). */
export async function updateTenantConnectionConfig(
  tenantId: string,
  provider: string,
  config: Record<string, unknown>,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("connections")
    .update({ config: config as Json })
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

/** Marque une connexion tenant comme deconnectee (sans supprimer les credentials). */
export async function disconnectTenantConnection(
  tenantId: string,
  provider: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("connections")
    .update({ status: "disconnected" })
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider);
}
