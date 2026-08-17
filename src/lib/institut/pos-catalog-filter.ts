import type { PosCatalogItem, PosCategory, PosServiceCategory } from "@/lib/institut/pos";

export const POS_FACET_ALL = "all";
export const POS_FACET_BESTSELLERS = "bestsellers";
export const POS_FACET_UNCATEGORIZED = "service:none";

export function serviceFacetId(categoryId: string) {
  return `service:${categoryId}`;
}

export function wooFacetId(name: string) {
  return `woo:${name}`;
}

export function itemMatchesTab(item: PosCatalogItem, tab: PosCategory): boolean {
  if (tab === "all") return true;
  return item.category === tab;
}

export function itemMatchesFacet(item: PosCatalogItem, facet: string): boolean {
  if (facet === POS_FACET_ALL) return true;
  if (facet === POS_FACET_BESTSELLERS) return (item.sold_qty ?? 0) > 0;
  if (facet === POS_FACET_UNCATEGORIZED) {
    return item.category === "service" && !item.service_category_id;
  }
  if (facet.startsWith("service:")) {
    return item.service_category_id === facet.slice("service:".length);
  }
  if (facet.startsWith("woo:")) {
    const name = facet.slice("woo:".length);
    return (item.woo_categories ?? []).includes(name);
  }
  return true;
}

export function itemMatchesQuery(item: PosCatalogItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.name.toLowerCase().includes(q)) return true;
  if (item.sku?.toLowerCase().includes(q)) return true;
  if (item.service_category_name?.toLowerCase().includes(q)) return true;
  if (item.woo_categories?.some((name) => name.toLowerCase().includes(q))) return true;
  return false;
}

export function filterPosCatalog(
  catalog: PosCatalogItem[],
  tab: PosCategory,
  facet: string,
  query: string,
): PosCatalogItem[] {
  const items = catalog.filter(
    (item) =>
      itemMatchesTab(item, tab) &&
      itemMatchesFacet(item, facet) &&
      itemMatchesQuery(item, query),
  );
  if (facet !== POS_FACET_BESTSELLERS) return items;
  return [...items].sort(
    (a, b) =>
      (b.sold_qty ?? 0) - (a.sold_qty ?? 0) || a.name.localeCompare(b.name, "fr"),
  );
}

export function listServiceCategoryFacets(
  catalog: PosCatalogItem[],
  tab: PosCategory,
  serviceCategories: PosServiceCategory[],
): PosServiceCategory[] {
  if (tab !== "all" && tab !== "service") return [];
  const used = new Set(
    catalog
      .filter((item) => item.category === "service")
      .map((item) => item.service_category_id)
      .filter((id): id is string => Boolean(id)),
  );
  return serviceCategories.filter((category) => used.has(category.id));
}

export function listWooCategoryFacets(
  catalog: PosCatalogItem[],
  tab: PosCategory,
): string[] {
  if (tab !== "all" && tab !== "woocommerce") return [];
  const names = new Set<string>();
  for (const item of catalog) {
    if (item.category !== "woocommerce") continue;
    for (const name of item.woo_categories ?? []) {
      const trimmed = name.trim();
      if (trimmed) names.add(trimmed);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, "fr"));
}

export function hasUncategorizedServices(
  catalog: PosCatalogItem[],
  tab: PosCategory,
): boolean {
  if (tab !== "all" && tab !== "service") return false;
  return catalog.some((item) => item.category === "service" && !item.service_category_id);
}
