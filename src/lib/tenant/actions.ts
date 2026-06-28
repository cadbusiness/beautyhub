"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TENANT_SLUG_COOKIE } from "@/lib/tenant/cookie";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function setTenantSlug(slug: string): Promise<void> {
  const jar = await cookies();
  jar.set(TENANT_SLUG_COOKIE, slug, COOKIE_OPTS);
}

export async function selectTenant(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;

  await setTenantSlug(slug);

  const next = String(formData.get("next") ?? "").trim();
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}
