"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTenants, isPlatformAdmin } from "@/lib/auth/session";
import { setTenantSlug } from "@/lib/tenant/actions";
import { resolveDefaultTenantSlug } from "@/lib/tenant/defaults";

export interface AuthState {
  error?: string;
}

async function applyDefaultTenant(): Promise<void> {
  const accessible = await getAccessibleTenants();
  const slug = resolveDefaultTenantSlug(accessible);
  if (!slug) return;
  await setTenantSlug(slug);
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    const t = await getTranslations("auth");
    return { error: t("supabaseNotConfigured") };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  await applyDefaultTenant();

  if (await isPlatformAdmin()) {
    redirect("/admin");
  }

  redirect("/institut");
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
