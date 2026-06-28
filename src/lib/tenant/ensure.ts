import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, getAccessibleTenants } from "@/lib/auth/session";
import { getTenantContext } from "@/lib/tenant/context";
import { TENANT_SLUG_COOKIE } from "@/lib/tenant/cookie";
import { resolveDefaultTenantSlug } from "@/lib/tenant/defaults";

/** Selectionne l'institut par defaut si aucun tenant n'est resolu (domaine racine). */
export async function ensureDefaultTenant(): Promise<void> {
  if (await getTenantContext()) return;

  const user = await getCurrentUser();
  if (!user) return;

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

  redirect("/dashboard");
}
