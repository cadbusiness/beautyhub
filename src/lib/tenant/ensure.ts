import { redirect } from "next/navigation";
import { getCurrentUser, getAccessibleTenants } from "@/lib/auth/session";
import { getTenantContext } from "@/lib/tenant/context";
import { resolveDefaultTenantSlug } from "@/lib/tenant/defaults";

/** Redirige vers la route qui pose le cookie tenant (impossible dans un layout RSC). */
export async function ensureDefaultTenant(): Promise<void> {
  if (await getTenantContext()) return;

  const user = await getCurrentUser();
  if (!user) return;

  const accessible = await getAccessibleTenants();
  const slug = resolveDefaultTenantSlug(accessible);
  if (!slug) return;

  redirect(`/auth/set-tenant?slug=${encodeURIComponent(slug)}&next=/dashboard`);
}
