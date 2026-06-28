import { cookies } from "next/headers";

export const TENANT_SLUG_COOKIE = "bh_tenant_slug";

export async function getTenantSlugFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(TENANT_SLUG_COOKIE)?.value?.trim();
  return value || null;
}
