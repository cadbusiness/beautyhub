import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
      let credentials: Record<string, unknown> | null = null;
      try {
        credentials = decryptCredentials(
          (data.credentials as { enc?: string }) ?? {},
        );
      } catch {
        // Keep pages resilient if encryption key is missing/invalid
        // or legacy credentials payload cannot be decrypted.
        continue;
      }

      return {
        scopeType: data.scope_type as ConnectionScope,
        scopeId: data.scope_id,
        provider: data.provider,
        status: data.status as "connected" | "disconnected",
        config: (data.config as Record<string, unknown>) ?? {},
        credentials,
      };
    }
  }

  return null;
}

/** Statut d'une connexion tenant (sans dechiffrer les credentials). */
export async function getTenantConnectionStatus(
  tenantId: string,
  provider: string,
  externalId?: string,
): Promise<{ status: "connected" | "disconnected"; config: Record<string, unknown> } | null> {
  const supabase = await createClient();
  let query = supabase
    .from("connections")
    .select("status, config")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider);

  if (externalId) {
    query = query.eq("external_id", externalId);
  } else {
    // Multi-connexions possibles (Woo) : on prend la plus récente par défaut.
    query = query.order("updated_at", { ascending: false }).limit(1);
  }

  const { data } = await query.maybeSingle();
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
  externalId?: string,
): Promise<void> {
  const supabase = await createClient();
  const enc = encryptCredentials(credentials);

  let existingQuery = supabase
    .from("connections")
    .select("id")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider);
  if (externalId) {
    existingQuery = existingQuery.eq("external_id", externalId);
  } else {
    existingQuery = existingQuery.is("external_id", null);
  }
  const { data: existing } = await existingQuery.maybeSingle();

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
      external_id: externalId ?? null,
      credentials: enc as Json,
      config: config as Json,
      status,
    });
    if (error) throw new Error(error.message);
  }
}

/** Cree ou met a jour une connexion tenant (service role — webhooks, pairing). */
export async function saveTenantConnectionWithService(
  tenantId: string,
  provider: string,
  credentials: Record<string, unknown>,
  config: Record<string, unknown> = {},
  status: "connected" | "disconnected" = "connected",
  externalId?: string,
): Promise<void> {
  const supabase = createServiceClient();
  const enc = encryptCredentials(credentials);

  let existingQuery = supabase
    .from("connections")
    .select("id")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider);
  if (externalId) {
    existingQuery = existingQuery.eq("external_id", externalId);
  } else {
    existingQuery = existingQuery.is("external_id", null);
  }
  const { data: existing } = await existingQuery.maybeSingle();

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
      external_id: externalId ?? null,
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
  externalId?: string,
): Promise<void> {
  const supabase = await createClient();
  let query = supabase
    .from("connections")
    .update({ status: "disconnected" })
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", provider);
  if (externalId) {
    query = query.eq("external_id", externalId);
  }
  await query;
}
