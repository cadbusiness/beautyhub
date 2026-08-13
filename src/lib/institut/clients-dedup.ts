import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type DedupMatchKind = "external" | "phone" | "email" | "name" | "created";

export type DedupInput = {
  tenantId: string;
  source: "manual" | "rovercash" | "woo" | "bookly" | "import";
  externalId: string | null;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Métadonnées supplémentaires à fusionner dans clients.metadata (ex: adresse Woo). */
  metadata?: Record<string, unknown>;
  /** Tags additionnels à poser sur le client (ex: "WooCommerce"). */
  extraTags?: string[];
  /** Ne jamais écraser un phone/email/full_name non-vide côté BH avec une valeur vide amont. */
  softMerge?: boolean;
};

export type DedupResult = {
  clientId: string;
  matched: DedupMatchKind;
  conflict?: {
    kind: "phone" | "email" | "name";
    candidateIds: string[];
  };
};

/** Normalise un téléphone comme la fonction SQL public.normalize_phone(). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D+/g, "");
  if (digits.length < 6) return null;
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `33${digits.slice(1)}`;
  }
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  return digits;
}

/** Normalise nom+prénom pour comparaison exacte (NFD, sans accents, lowercased, espaces compressés). */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return value || null;
}

function buildFullName(firstName: string | null, lastName: string | null): string | null {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  return value || null;
}

/** Génère un email "placeholder" si aucun email fourni : unique par source+externalId. */
function fallbackEmail(source: string, externalId: string | null): string {
  const suffix = externalId ? externalId : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${source}-${suffix}@no-email.local`;
}

type ExistingClient = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  updated_at: string;
  metadata: Record<string, unknown>;
  tags: string[] | null;
};

async function findByExternal(
  supabase: Db,
  tenantId: string,
  source: string,
  externalId: string,
): Promise<ExistingClient | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, email, phone, full_name, updated_at, metadata, tags")
    .eq("tenant_id", tenantId)
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw new Error(`dedup:external: ${error.message}`);
  return (data as ExistingClient | null) ?? null;
}

async function findByPhone(
  supabase: Db,
  tenantId: string,
  phone: string,
): Promise<ExistingClient[]> {
  const { data, error } = await supabase.rpc("dedup_find_by_phone", {
    p_tenant_id: tenantId,
    p_normalized_phone: phone,
  });
  if (error) throw new Error(`dedup:phone: ${error.message}`);
  return ((data ?? []) as ExistingClient[]) ?? [];
}

async function findByEmail(
  supabase: Db,
  tenantId: string,
  email: string,
): Promise<ExistingClient | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, email, phone, full_name, updated_at, metadata, tags")
    .eq("tenant_id", tenantId)
    .ilike("email", email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`dedup:email: ${error.message}`);
  return (data as ExistingClient | null) ?? null;
}

async function findByName(
  supabase: Db,
  tenantId: string,
  fullName: string,
): Promise<ExistingClient[]> {
  const normalized = normalizeName(fullName);
  if (!normalized) return [];
  const { data, error } = await supabase.rpc("dedup_find_by_name", {
    p_tenant_id: tenantId,
    p_normalized_full_name: normalized,
  });
  if (error) throw new Error(`dedup:name: ${error.message}`);
  return ((data ?? []) as ExistingClient[]) ?? [];
}

function mergeTags(existing: string[] | null, extra: string[] | undefined): string[] {
  const set = new Set<string>((existing ?? []).filter(Boolean));
  for (const t of extra ?? []) {
    if (t && t.trim()) set.add(t.trim());
  }
  return Array.from(set);
}

function mergeMetadata(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...(incoming ?? {}) };
}

async function updateExistingClient(
  supabase: Db,
  client: ExistingClient,
  input: DedupInput,
  matched: Exclude<DedupMatchKind, "created">,
): Promise<void> {
  const normalizedPhone = input.phone && input.phone.trim() ? input.phone.trim() : null;
  const normalizedEmail = normalizeEmail(input.email);
  const fullName = buildFullName(input.firstName, input.lastName);

  const softMerge = input.softMerge ?? true;

  const patch: Database["public"]["Tables"]["clients"]["Update"] = {
    metadata: mergeMetadata(
      (client.metadata as Record<string, unknown>) ?? {},
      {
        ...(input.metadata ?? {}),
        ...(input.externalId ? { [`${input.source}_ref`]: input.externalId } : {}),
      },
    ) as Database["public"]["Tables"]["clients"]["Update"]["metadata"],
    tags: mergeTags(client.tags, input.extraTags),
  };

  if (input.externalId) {
    patch.external_id = input.externalId;
  }
  // Ne rétrograde jamais un source déjà "riche" (rovercash/woo) vers "manual"
  if (input.source !== "manual") {
    patch.source = input.source;
  }
  if (normalizedPhone && (!softMerge || !client.phone)) {
    patch.phone = normalizedPhone;
  }
  if (fullName && (!softMerge || !client.full_name)) {
    patch.full_name = fullName;
  }
  // Email : on ne l'écrase que si l'existant est un placeholder @no-email.local
  if (normalizedEmail && client.email.endsWith("@no-email.local")) {
    patch.email = normalizedEmail;
  }

  const { error } = await supabase.from("clients").update(patch).eq("id", client.id);
  if (error) {
    // Duplicate email (unique constraint) : on garde la fiche existante, on retente sans le patch email
    if (error.code === "23505" && patch.email) {
      delete patch.email;
      const retry = await supabase.from("clients").update(patch).eq("id", client.id);
      if (retry.error) throw new Error(`dedup:update: ${retry.error.message}`);
      return;
    }
    throw new Error(`dedup:update:${matched}: ${error.message}`);
  }
}

async function insertNewClient(supabase: Db, input: DedupInput): Promise<string> {
  const normalizedEmail = normalizeEmail(input.email);
  const fullName = buildFullName(input.firstName, input.lastName);
  const phone = input.phone && input.phone.trim() ? input.phone.trim() : null;

  const insert: Database["public"]["Tables"]["clients"]["Insert"] = {
    tenant_id: input.tenantId,
    email: normalizedEmail && !normalizedEmail.endsWith("@no-email.local")
      ? normalizedEmail
      : fallbackEmail(input.source, input.externalId),
    full_name: fullName,
    phone,
    source: input.source,
    external_id: input.externalId ?? null,
    tags: mergeTags(null, input.extraTags),
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.externalId ? { [`${input.source}_ref`]: input.externalId } : {}),
    } as Database["public"]["Tables"]["clients"]["Insert"]["metadata"],
  };

  const { data, error } = await supabase.from("clients").insert(insert).select("id").single();
  if (error || !data) {
    // Race : deux inserts simultanés sur le même (tenant, source, external_id). On relit.
    if (error?.code === "23505" && input.externalId) {
      const existing = await findByExternal(supabase, input.tenantId, input.source, input.externalId);
      if (existing) return existing.id;
    }
    // Race sur (tenant, email) unique : on relit par email
    if (error?.code === "23505" && normalizedEmail) {
      const existing = await findByEmail(supabase, input.tenantId, normalizedEmail);
      if (existing) return existing.id;
    }
    throw new Error(`dedup:insert: ${error?.message ?? "unknown"}`);
  }
  return data.id;
}

/**
 * Trouve un client BH existant qui correspond à l'input, ou en crée un nouveau.
 *
 * Ordre de matching (phone-first) :
 *   1. (source, external_id) exact
 *   2. phone normalisé (indicatif FR par défaut, 33XXXXXXXXX)
 *   3. email exact (case-insensitive)
 *   4. nom + prénom normalisé (NFD, sans accent, lowercased)
 *   5. sinon insert
 *
 * En cas de multi-match (ex: deux clients partagent le même téléphone), on prend
 * le plus récemment mis à jour et on log l'ambiguïté dans metadata.dedup_conflict.
 */
export async function findOrCreateClientFromExternal(
  supabase: Db,
  input: DedupInput,
): Promise<DedupResult> {
  // 1. External ID exact (idempotence des re-syncs)
  if (input.externalId) {
    const byExternal = await findByExternal(supabase, input.tenantId, input.source, input.externalId);
    if (byExternal) {
      await updateExistingClient(supabase, byExternal, input, "external");
      return { clientId: byExternal.id, matched: "external" };
    }
  }

  // 2. Phone normalisé
  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone) {
    const candidates = await findByPhone(supabase, input.tenantId, normalizedPhone);
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) =>
        (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
      )[0];
      await updateExistingClient(supabase, best, input, "phone");
      const conflict =
        candidates.length > 1
          ? {
              kind: "phone" as const,
              candidateIds: candidates.map((c) => c.id),
            }
          : undefined;
      if (conflict) {
        await supabase
          .from("clients")
          .update({
            metadata: mergeMetadata(
              (best.metadata as Record<string, unknown>) ?? {},
              { dedup_conflict: conflict },
            ) as Database["public"]["Tables"]["clients"]["Update"]["metadata"],
          })
          .eq("id", best.id);
      }
      return { clientId: best.id, matched: "phone", conflict };
    }
  }

  // 3. Email exact
  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail && !normalizedEmail.endsWith("@no-email.local")) {
    const byEmail = await findByEmail(supabase, input.tenantId, normalizedEmail);
    if (byEmail) {
      await updateExistingClient(supabase, byEmail, input, "email");
      return { clientId: byEmail.id, matched: "email" };
    }
  }

  // 4. Nom + prénom exact
  const fullName = buildFullName(input.firstName, input.lastName);
  if (fullName) {
    const candidates = await findByName(supabase, input.tenantId, fullName);
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) =>
        (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
      )[0];
      await updateExistingClient(supabase, best, input, "name");
      const conflict =
        candidates.length > 1
          ? {
              kind: "name" as const,
              candidateIds: candidates.map((c) => c.id),
            }
          : undefined;
      if (conflict) {
        await supabase
          .from("clients")
          .update({
            metadata: mergeMetadata(
              (best.metadata as Record<string, unknown>) ?? {},
              { dedup_conflict: conflict },
            ) as Database["public"]["Tables"]["clients"]["Update"]["metadata"],
          })
          .eq("id", best.id);
      }
      return { clientId: best.id, matched: "name", conflict };
    }
  }

  // 5. Insert
  const newId = await insertNewClient(supabase, input);
  return { clientId: newId, matched: "created" };
}

/**
 * Preview version : ne modifie rien, retourne juste la stratégie de match.
 * Utilisé côté API pour l'affichage "dry-run" du dialog d'import.
 */
export async function previewMatch(
  supabase: Db,
  input: Pick<DedupInput, "tenantId" | "source" | "externalId" | "phone" | "email" | "firstName" | "lastName">,
): Promise<{ kind: DedupMatchKind; clientId?: string }> {
  if (input.externalId) {
    const byExternal = await findByExternal(supabase, input.tenantId, input.source, input.externalId);
    if (byExternal) return { kind: "external", clientId: byExternal.id };
  }
  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone) {
    const candidates = await findByPhone(supabase, input.tenantId, normalizedPhone);
    if (candidates.length > 0) return { kind: "phone", clientId: candidates[0].id };
  }
  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail && !normalizedEmail.endsWith("@no-email.local")) {
    const byEmail = await findByEmail(supabase, input.tenantId, normalizedEmail);
    if (byEmail) return { kind: "email", clientId: byEmail.id };
  }
  const fullName = buildFullName(input.firstName, input.lastName);
  if (fullName) {
    const candidates = await findByName(supabase, input.tenantId, fullName);
    if (candidates.length > 0) return { kind: "name", clientId: candidates[0].id };
  }
  return { kind: "created" };
}
