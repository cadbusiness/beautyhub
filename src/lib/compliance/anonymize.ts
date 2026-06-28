import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type AnonymizeClientResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Anonymise une fiche client tout en conservant les ventes / RDV pour obligations comptables.
 * Ne supprime pas la ligne `clients` (intégrité référentielle).
 */
export async function anonymizeClient(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<AnonymizeClientResult> {
  const suffix = clientId.slice(0, 8);
  const anonymizedEmail = `anonymized-${suffix}@deleted.local`;

  const { error } = await supabase
    .from("clients")
    .update({
      email: anonymizedEmail,
      full_name: null,
      phone: null,
      date_of_birth: null,
      address_line1: null,
      address_line2: null,
      city: null,
      postal_code: null,
      country: null,
      notes: null,
      tags: [],
      marketing_opt_in: false,
      login_id: null,
      pin_code: null,
      pin_hash: null,
      password_hash: null,
      metadata: { anonymized: true, anonymized_at: new Date().toISOString() },
    })
    .eq("tenant_id", tenantId)
    .eq("id", clientId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function isAnonymizedClient(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "anonymized" in metadata &&
    (metadata as { anonymized?: boolean }).anonymized === true
  );
}

export function isAnonymizedClientEmail(email: string): boolean {
  return email.startsWith("anonymized-") && email.endsWith("@deleted.local");
}
