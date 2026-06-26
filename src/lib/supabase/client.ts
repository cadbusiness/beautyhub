import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { requireSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = requireSupabaseEnv();
  return createBrowserClient<Database>(env.url, env.anonKey);
}
