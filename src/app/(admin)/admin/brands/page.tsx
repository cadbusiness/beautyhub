import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchBrandListRows } from "@/lib/platform/brands";
import { BrandsManager } from "./brands-manager";

export default async function AdminBrandsPage() {
  await requirePlatformAdmin();
  const brands = await fetchBrandListRows();
  return <BrandsManager brands={brands} />;
}
