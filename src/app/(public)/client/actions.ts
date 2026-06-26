"use server";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant/context";
import {
  clearClientSession,
  getClientSession,
  setClientSession,
} from "@/lib/client-auth/session";
import { hashPassword, verifyPassword } from "@/lib/client-auth/password";
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
  const tenant = await getTenantContext();
  if (!tenant) return { error: "Institut introuvable." };

  const supabase = dbOrError();
  if (!supabase) return { error: "Configuration serveur incomplete (service role)." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email et mot de passe requis." };

  const { data: client } = await supabase
    .from("clients")
    .select("id, email, password_hash")
    .eq("tenant_id", tenant.id)
    .eq("email", email)
    .maybeSingle();

  if (!client?.password_hash) {
    return { error: "Compte introuvable ou mot de passe non defini." };
  }

  const valid = await verifyPassword(password, client.password_hash);
  if (!valid) return { error: "Identifiants incorrects." };

  await setClientSession({
    clientId: client.id,
    tenantId: tenant.id,
    email: client.email,
  });

  redirect("/client/compte");
}

export async function clientRegister(
  _prev: ClientAuthResult,
  formData: FormData,
): Promise<ClientAuthResult> {
  const tenant = await getTenantContext();
  if (!tenant) return { error: "Institut introuvable." };

  const supabase = dbOrError();
  if (!supabase) return { error: "Configuration serveur incomplete (service role)." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!email || !password || !fullName) return { error: "Tous les champs sont requis." };
  if (password.length < 8) return { error: "Mot de passe: 8 caracteres minimum." };

  const passwordHash = await hashPassword(password);

  const { data: existing } = await supabase
    .from("clients")
    .select("id, password_hash")
    .eq("tenant_id", tenant.id)
    .eq("email", email)
    .maybeSingle();

  if (existing?.password_hash) {
    return { error: "Un compte existe deja pour cet email." };
  }

  if (existing) {
    await supabase
      .from("clients")
      .update({ password_hash: passwordHash, full_name: fullName })
      .eq("id", existing.id);
    await setClientSession({
      clientId: existing.id,
      tenantId: tenant.id,
      email,
    });
  } else {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        tenant_id: tenant.id,
        email,
        full_name: fullName,
        password_hash: passwordHash,
      })
      .select("id")
      .single();
    if (error || !created) return { error: error?.message ?? "Erreur creation compte." };
    await setClientSession({
      clientId: created.id,
      tenantId: tenant.id,
      email,
    });
  }

  redirect("/client/compte");
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
