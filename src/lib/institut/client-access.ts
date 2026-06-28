import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { generatePinCode, hashPin } from "@/lib/client-auth/pin";
import {
  formatClientLoginId,
  parseClientLoginIdSequence,
  tenantClientIdPrefix,
} from "@/lib/institut/client-login-id";

type Db = SupabaseClient<Database>;

async function getTenantPrefix(
  supabase: Db,
  tenantId: string,
): Promise<string> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .maybeSingle();

  return tenantClientIdPrefix(tenant?.name ?? "", tenant?.slug ?? "");
}

export async function generateClientLoginId(
  supabase: Db,
  tenantId: string,
): Promise<string> {
  const prefix = await getTenantPrefix(supabase, tenantId);

  const { data: clients } = await supabase
    .from("clients")
    .select("login_id")
    .eq("tenant_id", tenantId)
    .not("login_id", "is", null);

  let maxSeq = 0;
  for (const row of clients ?? []) {
    if (!row.login_id) continue;
    const seq = parseClientLoginIdSequence(row.login_id, prefix);
    if (seq !== null && seq > maxSeq) maxSeq = seq;
  }

  return formatClientLoginId(prefix, maxSeq + 1);
}

export async function provisionClientAccess(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<{ loginId: string; pinCode: string }> {
  const { data: client } = await supabase
    .from("clients")
    .select("login_id, pin_hash, pin_code")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) throw new Error("client_not_found");

  if (client.login_id && client.pin_hash && client.pin_code) {
    return { loginId: client.login_id, pinCode: client.pin_code };
  }

  const loginId = client.login_id ?? (await generateClientLoginId(supabase, tenantId));
  const pinCode = generatePinCode();
  const pinHash = await hashPin(pinCode);

  const { error } = await supabase
    .from("clients")
    .update({
      login_id: loginId,
      pin_code: pinCode,
      pin_hash: pinHash,
      password_hash: null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", clientId);

  if (error) throw error;

  return { loginId, pinCode };
}

export async function regenerateClientPin(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<{ loginId: string; pinCode: string }> {
  const { data: client } = await supabase
    .from("clients")
    .select("login_id")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) throw new Error("client_not_found");

  const loginId = client.login_id ?? (await generateClientLoginId(supabase, tenantId));
  const pinCode = generatePinCode();
  const pinHash = await hashPin(pinCode);

  const { error } = await supabase
    .from("clients")
    .update({
      login_id: loginId,
      pin_code: pinCode,
      pin_hash: pinHash,
      password_hash: null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", clientId);

  if (error) throw error;

  return { loginId, pinCode };
}

export async function upgradeLegacyClientLoginId(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  const { data: client } = await supabase
    .from("clients")
    .select("login_id")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.login_id || !/^\d{4,8}$/.test(client.login_id)) {
    return client?.login_id ?? null;
  }

  const loginId = await generateClientLoginId(supabase, tenantId);
  const { error } = await supabase
    .from("clients")
    .update({ login_id: loginId })
    .eq("tenant_id", tenantId)
    .eq("id", clientId);

  if (error) throw error;
  return loginId;
}
