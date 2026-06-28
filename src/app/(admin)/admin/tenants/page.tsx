import { requirePlatformAdmin } from "@/lib/auth/guards";
import {
  fetchActivePlansForSelect,
  fetchTenantListRows,
} from "@/lib/platform/tenants";
import { TenantsManager } from "./tenants-manager";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  await requirePlatformAdmin();
  const { brand: brandFilter } = await searchParams;
  const [tenants, plans] = await Promise.all([
    fetchTenantListRows(),
    fetchActivePlansForSelect(),
  ]);

  const rows = brandFilter
    ? tenants.filter((t) => t.brandId === brandFilter)
    : tenants;

  return <TenantsManager tenants={rows} plans={plans} brandFilter={brandFilter} />;
}
