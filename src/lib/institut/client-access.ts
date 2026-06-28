import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { generatePinCode, hashPin } from "@/lib/client-auth/pin";

type Db = SupabaseClient<Database>;

export async function generateClientLoginId(
  supabase: Db,
  tenantId: string,
): Promise<string> {
  const { data } = await supabase
    .from("clients")
    .select("login_id")
    .eq("tenant_id", tenantId)
    .not("login_id", "is", null)
    .order("login_id", { ascending: false })
    .limit(1);

  const last = data?.[0]?.login_id ? Number.parseInt(data[0].login_id, 10) : 100_000;
  const next = Number.isFinite(last) ? last + 1 : 100_001;
  return String(next).padStart(6, "0");
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
