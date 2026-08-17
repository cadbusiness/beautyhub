import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * Client "service role" — bypasse RLS. A n'utiliser QUE cote serveur,
 * pour des operations admin maitrisees (auth client final, installateur, webhooks).
 * Ne jamais exposer la cle au navigateur.
 */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante (operation serveur).");
  }
  const env = requireSupabaseEnv();
  return createSupabaseClient<Database>(env.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Client service role si la clé est présente, sinon null (intégrations optionnelles). */
export function tryCreateServiceClient() {
  if (!hasServiceRoleKey()) return null;
  return createServiceClient();
}
