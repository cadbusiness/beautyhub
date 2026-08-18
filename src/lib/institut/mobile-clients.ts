import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { provisionClientAccess } from "@/lib/institut/client-access";
import { recordConsentEvent } from "@/lib/compliance/consent";
import { parseClientTags } from "@/lib/institut/clients";

type Db = SupabaseClient<Database>;
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export const MOBILE_CLIENT_SELECT =
  "id, full_name, email, phone, date_of_birth, address_line1, address_line2, city, postal_code, country, notes, tags, marketing_opt_in, login_id, created_at";

/** Liste / recherche : assez léger pour rester fluide à 5000+ fiches. */
export const MOBILE_CLIENT_LIST_SELECT =
  "id, full_name, email, phone, tags, marketing_opt_in, login_id, created_at";

export type MobileClientRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  tags: string[] | null;
  marketing_opt_in: boolean | null;
  login_id: string | null;
  created_at: string;
};

export type MobileClientJson = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  marketingOptIn: boolean;
  hasAccount: boolean;
  createdAt: string;
};

export type MobileClientWriteInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
  tags?: string[] | string | null;
  marketingOptIn?: boolean;
  createAccount?: boolean;
};

function asString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return String(value);
  return value;
}

export function parseMobileClientBody(raw: unknown): MobileClientWriteInput {
  const body =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const tags = body.tags;
  return {
    fullName: asString(body.fullName),
    email: asString(body.email),
    phone: asString(body.phone),
    dateOfBirth: asString(body.dateOfBirth),
    addressLine1: asString(body.addressLine1),
    addressLine2: asString(body.addressLine2),
    city: asString(body.city),
    postalCode: asString(body.postalCode),
    country: asString(body.country),
    notes: asString(body.notes),
    tags: Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === "string")
      : typeof tags === "string"
        ? tags
        : undefined,
    marketingOptIn: body.marketingOptIn === undefined ? undefined : body.marketingOptIn === true,
    createAccount: body.createAccount === undefined ? undefined : body.createAccount === true,
  };
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (
    email.endsWith("@beautyhub.local") ||
    email.endsWith("@no-email.local") ||
    email.endsWith("@overcache.local") ||
    email.includes("@import.")
  );
}

export function serializeMobileClient(row: MobileClientRow): MobileClientJson {
  const displayEmail = isPlaceholderEmail(row.email) ? null : row.email;
  return {
    id: row.id,
    fullName: row.full_name ?? null,
    email: displayEmail,
    phone: row.phone ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    addressLine1: row.address_line1 ?? null,
    addressLine2: row.address_line2 ?? null,
    city: row.city ?? null,
    postalCode: row.postal_code ?? null,
    country: row.country ?? null,
    notes: row.notes ?? null,
    tags: row.tags ?? [],
    marketingOptIn: row.marketing_opt_in ?? false,
    hasAccount: Boolean(row.login_id),
    createdAt: row.created_at,
  };
}

export function clientPickerLabel(item: MobileClientJson): string {
  if (item.fullName) {
    return item.email ? `${item.fullName} (${item.email})` : item.fullName;
  }
  return item.email ?? item.phone ?? "Cliente";
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = blankToNull(value)?.toLowerCase() ?? null;
  return trimmed;
}

function normalizeTags(value: string[] | string | null | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (typeof value === "string") return parseClientTags(value);
  return value
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

export function validateMobileClientWrite(
  input: MobileClientWriteInput,
  mode: "create" | "update",
):
  | { ok: true; email: string | null; tags?: string[] }
  | { ok: false; error: string; code: string } {
  const email = input.email !== undefined ? normalizeEmail(input.email) : undefined;
  const fullName = input.fullName !== undefined ? blankToNull(input.fullName) : undefined;
  const phone = input.phone !== undefined ? blankToNull(input.phone) : undefined;

  if (email && !email.includes("@")) {
    return { ok: false, error: "Email invalide.", code: "invalid_email" };
  }
  if (input.createAccount && !email && mode === "create") {
    return {
      ok: false,
      error: "Email requis pour créer un compte cliente.",
      code: "email_required_for_account",
    };
  }
  if (input.dateOfBirth && !isValidDate(input.dateOfBirth)) {
    return { ok: false, error: "Date de naissance invalide.", code: "invalid_date" };
  }
  if (mode === "create" && !email && !fullName && !phone) {
    return {
      ok: false,
      error: "Nom, email ou téléphone requis.",
      code: "missing_fields",
    };
  }
  return { ok: true, email: email ?? null, tags: normalizeTags(input.tags) };
}

export async function createMobileClient(
  supabase: Db,
  tenantId: string,
  actorId: string | null,
  input: MobileClientWriteInput,
): Promise<
  | { item: MobileClientJson; account: { loginId: string; pinCode: string } | null }
  | { error: string; code: string; status: number }
> {
  const validated = validateMobileClientWrite(input, "create");
  if (!validated.ok) {
    return { error: validated.error, code: validated.code, status: 400 };
  }

  const email = validated.email;
  const effectiveEmail = email || `noemail+${crypto.randomUUID()}@beautyhub.local`;
  const insertPayload: ClientInsert = {
    tenant_id: tenantId,
    email: effectiveEmail,
    full_name: blankToNull(input.fullName),
    phone: blankToNull(input.phone),
    date_of_birth: blankToNull(input.dateOfBirth),
    address_line1: blankToNull(input.addressLine1),
    address_line2: blankToNull(input.addressLine2),
    city: blankToNull(input.city),
    postal_code: blankToNull(input.postalCode),
    country: blankToNull(input.country) ?? "FR",
    notes: blankToNull(input.notes),
    tags: validated.tags ?? [],
    marketing_opt_in: input.marketingOptIn === true,
    source: "manual",
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select(MOBILE_CLIENT_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        error: "Une cliente avec cet email existe déjà.",
        code: "email_exists",
        status: 409,
      };
    }
    return {
      error: error?.message ?? "Création impossible.",
      code: "insert_failed",
      status: 500,
    };
  }

  let row = data as MobileClientRow;
  if (input.marketingOptIn === true) {
    await recordConsentEvent(supabase, {
      tenantId,
      clientId: row.id,
      consentType: "marketing",
      granted: true,
      source: "mobile_client_form",
      actorType: "staff",
      actorId,
    });
  }

  let account: { loginId: string; pinCode: string } | null = null;
  if (input.createAccount) {
    try {
      account = await provisionClientAccess(supabase, tenantId, row.id);
      const { data: reloaded } = await supabase
        .from("clients")
        .select(MOBILE_CLIENT_SELECT)
        .eq("tenant_id", tenantId)
        .eq("id", row.id)
        .maybeSingle();
      if (reloaded) row = reloaded as MobileClientRow;
    } catch (e) {
      console.error("[mobile/clients] provisionClientAccess failed", e);
    }
  }

  return { item: serializeMobileClient(row), account };
}

export async function updateMobileClient(
  supabase: Db,
  tenantId: string,
  clientId: string,
  actorId: string | null,
  input: MobileClientWriteInput,
): Promise<
  | { item: MobileClientJson; account: { loginId: string; pinCode: string } | null }
  | { error: string; code: string; status: number }
> {
  const validated = validateMobileClientWrite(input, "update");
  if (!validated.ok) {
    return { error: validated.error, code: validated.code, status: 400 };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("clients")
    .select("id, email, marketing_opt_in, login_id")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  if (existingErr) {
    return { error: existingErr.message, code: "fetch_failed", status: 500 };
  }
  if (!existing) {
    return { error: "Cliente introuvable.", code: "not_found", status: 404 };
  }

  const patch: ClientUpdate = {};
  if (input.fullName !== undefined) patch.full_name = blankToNull(input.fullName);
  if (input.phone !== undefined) patch.phone = blankToNull(input.phone);
  if (input.dateOfBirth !== undefined) patch.date_of_birth = blankToNull(input.dateOfBirth);
  if (input.addressLine1 !== undefined) patch.address_line1 = blankToNull(input.addressLine1);
  if (input.addressLine2 !== undefined) patch.address_line2 = blankToNull(input.addressLine2);
  if (input.city !== undefined) patch.city = blankToNull(input.city);
  if (input.postalCode !== undefined) patch.postal_code = blankToNull(input.postalCode);
  if (input.country !== undefined) patch.country = blankToNull(input.country);
  if (input.notes !== undefined) patch.notes = blankToNull(input.notes);
  if (validated.tags !== undefined) patch.tags = validated.tags;
  if (input.marketingOptIn !== undefined) patch.marketing_opt_in = input.marketingOptIn;

  if (input.email !== undefined) {
    const nextEmail = validated.email;
    patch.email = nextEmail || `noemail+${crypto.randomUUID()}@beautyhub.local`;
  }

  if (Object.keys(patch).length === 0 && !input.createAccount) {
    const { data: current } = await supabase
      .from("clients")
      .select(MOBILE_CLIENT_SELECT)
      .eq("tenant_id", tenantId)
      .eq("id", clientId)
      .maybeSingle();
    if (!current) {
      return { error: "Cliente introuvable.", code: "not_found", status: 404 };
    }
    return { item: serializeMobileClient(current as MobileClientRow), account: null };
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("clients")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("id", clientId);
    if (error) {
      if (error.code === "23505") {
        return {
          error: "Une cliente avec cet email existe déjà.",
          code: "email_exists",
          status: 409,
        };
      }
      return { error: error.message, code: "update_failed", status: 500 };
    }
  }

  if (
    input.marketingOptIn !== undefined &&
    existing.marketing_opt_in !== input.marketingOptIn
  ) {
    await recordConsentEvent(supabase, {
      tenantId,
      clientId,
      consentType: "marketing",
      granted: input.marketingOptIn,
      source: "mobile_client_form",
      actorType: "staff",
      actorId,
    });
  }

  let account: { loginId: string; pinCode: string } | null = null;
  if (input.createAccount && !existing.login_id) {
    const emailForAccount =
      input.email !== undefined ? validated.email : (isPlaceholderEmail(existing.email) ? null : existing.email);
    if (!emailForAccount) {
      return {
        error: "Email requis pour créer un compte cliente.",
        code: "email_required_for_account",
        status: 400,
      };
    }
    try {
      account = await provisionClientAccess(supabase, tenantId, clientId);
    } catch (e) {
      console.error("[mobile/clients] provisionClientAccess failed", e);
    }
  }

  const { data: updated, error: reloadErr } = await supabase
    .from("clients")
    .select(MOBILE_CLIENT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();
  if (reloadErr || !updated) {
    return {
      error: reloadErr?.message ?? "Cliente introuvable.",
      code: "fetch_failed",
      status: reloadErr ? 500 : 404,
    };
  }

  return { item: serializeMobileClient(updated as MobileClientRow), account };
}
