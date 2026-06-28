export const DEFAULT_TENANT_SLUG = "demo";

export interface TenantOption {
  slug: string;
  name: string;
  role: string;
}

/** Institut ouvert par defaut quand aucun cookie tenant n'est defini. */
export function resolveDefaultTenantSlug(
  tenants: Pick<TenantOption, "slug">[],
): string | null {
  if (tenants.length === 0) return null;
  if (tenants.length === 1) return tenants[0].slug;
  const demo = tenants.find((t) => t.slug === DEFAULT_TENANT_SLUG);
  if (demo) return demo.slug;
  return tenants[0].slug;
}
