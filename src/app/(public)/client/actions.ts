"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTenantContext } from "@/lib/tenant/context";
import {
  clearClientSession,
  getClientSession,
  setClientSession,
} from "@/lib/client-auth/session";
import { isValidLoginId, isValidPin, verifyPin } from "@/lib/client-auth/pin";
import { verifyPassword } from "@/lib/client-auth/password";
import { createServiceClient } from "@/lib/supabase/service";

export interface ClientAuthResult {
  error?: string;
  ok?: boolean;
}

function dbOrError(): ReturnType<typeof createServiceClient> | null {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

export async function clientLogin(
  _prev: ClientAuthResult,
  formData: FormData,
): Promise<ClientAuthResult> {
  const actions = await getTranslations("institut.actions");
  const tenant = await getTenantContext();
  if (!tenant) return { error: actions("tenantNotFound") };

  const supabase = dbOrError();
  if (!supabase) return { error: actions("serverConfigIncomplete") };

  const loginId = String(formData.get("login_id") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!loginId || !pin) return { error: actions("loginIdPinRequired") };
  if (!isValidLoginId(loginId)) return { error: actions("invalidLoginId") };
  if (!isValidPin(pin)) return { error: actions("invalidPin") };

  const { data: client } = await supabase
    .from("clients")
    .select("id, email, login_id, pin_hash, password_hash")
    .eq("tenant_id", tenant.id)
    .eq("login_id", loginId)
    .maybeSingle();

  if (!client) {
    return { error: actions("accountNotFound") };
  }

  let valid = false;
  if (client.pin_hash) {
    valid = await verifyPin(pin, client.pin_hash);
  } else if (client.password_hash) {
    valid = await verifyPassword(pin, client.password_hash);
  }

  if (!valid) return { error: actions("invalidCredentials") };

  await setClientSession({
    clientId: client.id,
    tenantId: tenant.id,
    email: client.email,
    loginId: client.login_id ?? loginId,
  });

  redirect("/client/compte");
}

export async function clientRegister(
  _prev: ClientAuthResult,
  _formData: FormData,
): Promise<ClientAuthResult> {
  const actions = await getTranslations("institut.actions");
  return { error: actions("clientSelfRegisterDisabled") };
}

export async function clientLogout(): Promise<void> {
  await clearClientSession();
  redirect("/client/login");
}

export async function cancelClientAppointment(formData: FormData): Promise<void> {
  const tenant = await getTenantContext();
  if (!tenant) return;
  const session = await getClientSession(tenant.id);
  if (!session) redirect("/client/login");

  const supabase = dbOrError();
  if (!supabase) return;

  await supabase
    .from("inst_appointments")
    .update({ status: "cancelled" })
    .eq("id", String(formData.get("id")))
    .eq("client_id", session.clientId)
    .eq("tenant_id", tenant.id);

  redirect("/client/compte");
}
