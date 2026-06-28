"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTenants, isPlatformAdmin } from "@/lib/auth/session";
import { TENANT_SLUG_COOKIE } from "@/lib/tenant/cookie";
import { resolveDefaultTenantSlug } from "@/lib/tenant/defaults";

export interface AuthState {
  error?: string;
}

async function applyDefaultTenant(): Promise<void> {
  const accessible = await getAccessibleTenants();
  const slug = resolveDefaultTenantSlug(accessible);
  if (!slug) return;

  const jar = await cookies();
  jar.set(TENANT_SLUG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Service indisponible: Supabase non configuré sur ce déploiement." };
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
