import type {
  PosCatalogItem,
  PosCategory,
  PosProductCategory,
  PosServiceCategory,
} from "@/lib/institut/pos";
import type { WooSoinsChild } from "@/lib/woocommerce/product-labels";

export const POS_FACET_ALL = "all";
export const POS_FACET_BESTSELLERS = "bestsellers";
export const POS_FACET_UNCATEGORIZED = "service:none";
export const POS_FACET_INTERNAL_UNCATEGORIZED = "product:none";
export const POS_FACET_SOINS = "woo-group:soins";
export const POS_FACET_MARQUES = "woo-group:marques";

const SOINS_ORDER: WooSoinsChild[] = ["Visage", "Corps", "Cheveux", "autres"];
const SOINS_LABELS: Record<WooSoinsChild, string> = {
  Visage: "Visage",
  Corps: "Corps",
  Cheveux: "Cheveux",
  autres: "Autres soins",
};

export function serviceFacetId(categoryId: string) {
  return `service:${categoryId}`;
}

export function productFacetId(categoryId: string) {
  return `product:${categoryId}`;
}

export function wooFacetId(name: string) {
  return `woo:${name}`;
}

export function wooSoinsFacetId(child: WooSoinsChild) {
  return `woo-soins:${child}`;
}

export function wooBrandFacetId(name: string) {
  return `woo-brand:${name}`;
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
  if (facet === POS_FACET_INTERNAL_UNCATEGORIZED) {
    return item.category === "internal" && !item.product_category_id;
  }
  if (facet.startsWith("service:")) {
    return item.service_category_id === facet.slice("service:".length);
  }
  if (facet.startsWith("product:")) {
    return item.product_category_id === facet.slice("product:".length);
  }
  if (facet === POS_FACET_SOINS) {
    return (item.woo_soins ?? []).length > 0;
  }
  if (facet === POS_FACET_MARQUES) {
    return (item.woo_brands ?? []).length > 0;
  }
  if (facet.startsWith("woo-soins:")) {
    const child = facet.slice("woo-soins:".length) as WooSoinsChild;
    return (item.woo_soins ?? []).includes(child);
  }
  if (facet.startsWith("woo-brand:")) {
    const brand = facet.slice("woo-brand:".length);
    return (item.woo_brands ?? []).includes(brand);
  }
  if (facet.startsWith("woo:")) {
    const name = facet.slice("woo:".length);
    if ((item.woo_categories ?? []).includes(name)) return true;
    return (item.woo_brands ?? []).includes(name);
  }
  return true;
}

export function itemMatchesQuery(item: PosCatalogItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.name.toLowerCase().includes(q)) return true;
  if (item.sku?.toLowerCase().includes(q)) return true;
  if (item.service_category_name?.toLowerCase().includes(q)) return true;
  if (item.product_category_name?.toLowerCase().includes(q)) return true;
  if (item.woo_categories?.some((name) => name.toLowerCase().includes(q))) return true;
  if (item.woo_brands?.some((name) => name.toLowerCase().includes(q))) return true;
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

export function listProductCategoryFacets(
  tab: PosCategory,
  productCategories: PosProductCategory[],
): PosProductCategory[] {
  if (tab !== "all" && tab !== "internal") return [];
  return productCategories;
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

export type WooNavChild = { id: string; name: string };

export type WooNavGroups = {
  soins: WooNavChild[];
  marques: WooNavChild[];
};

export function listWooNavGroups(
  catalog: PosCatalogItem[],
  tab: PosCategory,
): WooNavGroups {
  if (tab !== "all" && tab !== "woocommerce") {
    return { soins: [], marques: [] };
  }
  const soinsPresent = new Set<WooSoinsChild>();
  const brands = new Set<string>();
  for (const item of catalog) {
    if (item.category !== "woocommerce") continue;
    for (const child of item.woo_soins ?? []) soinsPresent.add(child);
    for (const brand of item.woo_brands ?? []) {
      if (brand.trim()) brands.add(brand.trim());
    }
  }
  return {
    soins: SOINS_ORDER.filter((child) => soinsPresent.has(child)).map((child) => ({
      id: wooSoinsFacetId(child),
      name: SOINS_LABELS[child],
    })),
    marques: Array.from(brands)
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((name) => ({ id: wooBrandFacetId(name), name })),
  };
}

export function expandedWooGroup(
  facet: string,
): "soins" | "marques" | null {
  if (facet === POS_FACET_SOINS || facet.startsWith("woo-soins:")) return "soins";
  if (facet === POS_FACET_MARQUES || facet.startsWith("woo-brand:")) {
    return "marques";
  }
  return null;
}

export function hasUncategorizedServices(
  catalog: PosCatalogItem[],
  tab: PosCategory,
): boolean {
  if (tab !== "all" && tab !== "service") return false;
  return catalog.some((item) => item.category === "service" && !item.service_category_id);
}

export function hasUncategorizedInternalProducts(
  catalog: PosCatalogItem[],
  tab: PosCategory,
): boolean {
  if (tab !== "all" && tab !== "internal") return false;
  return catalog.some((item) => item.category === "internal" && !item.product_category_id);
}
