"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TENANT_SLUG_COOKIE } from "@/lib/tenant/cookie";

export async function selectTenant(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;

  const jar = await cookies();
  jar.set(TENANT_SLUG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
