/** Classification POS des produits Woo : Soins (Visage/Corps/Cheveux) vs Marques. */

export type WooSoinsChild = "Visage" | "Corps" | "Cheveux" | "autres";

const BRAND_ALIASES: Array<{ match: RegExp; canonical: string }> = [
  { match: /^1944(\s*paris)?$/i, canonical: "1944 Paris" },
  { match: /^(body\s+)?strategist$/i, canonical: "BODY STRATEGIST" },
  { match: /^\[?\s*comfor?t\s*zone\s*\]?$/i, canonical: "[ comfort zone ]" },
  { match: /^lola['’]?s?\s*apothecary$/i, canonical: "Lola's Apothecary" },
  { match: /^nailmatic$/i, canonical: "Nailmatic" },
  { match: /^malin\s*\+?\s*goetz$/i, canonical: "MALIN+GOETZ" },
  { match: /^bomb\s*raw$/i, canonical: "Bomb raw" },
  { match: /^meraki$/i, canonical: "meraki" },
  { match: /^baija$/i, canonical: "Baija" },
  { match: /^lebon$/i, canonical: "Lebon" },
  { match: /^moro(\s*d[ée]odorant)?$/i, canonical: "MORO déodorant" },
  { match: /^chambre\s*52$/i, canonical: "Chambre 52" },
  { match: /^frapin$/i, canonical: "Frapin" },
  { match: /^davines$/i, canonical: "Davines" },
  { match: /^chillsilk$/i, canonical: "Chillsilk" },
  { match: /^nougatine$/i, canonical: "Nougatine" },
  { match: /^(l['’])?escale\s+des\s+sens$/i, canonical: "L'Escale des Sens" },
  { match: /^apricot$/i, canonical: "Apricot" },
  { match: /^kanjo$/i, canonical: "Kanjo" },
  { match: /^queen of roses$/i, canonical: "Queen of Roses" },
  { match: /^scenta$/i, canonical: "Scenta" },
  { match: /^ma-?tchat?cha$/i, canonical: "Ma-tchatcha" },
  { match: /^obvius$/i, canonical: "Obvius" },
];

const KNOWN_BRANDS = Array.from(
  new Set(BRAND_ALIASES.map((a) => a.canonical)),
);

const BRAND_NOISE =
  /^(place\s+reserv[eé]e?|promo|travel\s*size|bon\s+cadeau|sb\s+collection|recharge(s)?)$/i;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

export function nameBrandSuffix(name: string): string | null {
  const idx = name.lastIndexOf(" | ");
  if (idx < 0) return null;
  const suffix = decodeHtml(name.slice(idx + 3));
  return suffix.length > 0 ? suffix : null;
}

export function matchBrandAlias(raw: string): string | null {
  const trimmed = decodeHtml(raw);
  if (!trimmed) return null;
  for (const alias of BRAND_ALIASES) {
    if (alias.match.test(trimmed)) return alias.canonical;
  }
  const known = KNOWN_BRANDS.find(
    (brand) => brand.toLowerCase() === trimmed.toLowerCase(),
  );
  return known ?? null;
}

export function canonicalizeBrandLabel(raw: string): string | null {
  const trimmed = decodeHtml(raw);
  if (!trimmed || BRAND_NOISE.test(trimmed) || trimmed.endsWith("?")) {
    return null;
  }
  const aliased = matchBrandAlias(trimmed);
  if (aliased) return aliased;
  if (soinsChildFromLabel(trimmed)) return null;
  return trimmed;
}

export function inferBrandFromProductName(name: string): string | null {
  const suffix = nameBrandSuffix(name);
  if (!suffix) return null;
  return canonicalizeBrandLabel(suffix);
}

function soinsChildFromLabel(label: string): WooSoinsChild | null {
  const s = decodeHtml(label);
  if (!s) return null;
  if (/^soins$/i.test(s) || /^marques$/i.test(s) || /^uncategorized$/i.test(s)) {
    return null;
  }
  if (/cheveu|shampoing|conditioner|cuir chevelu/i.test(s)) return "Cheveux";
  if (
    /visage|maquill|teint|l[èe]vre|yeux|cernes|acn[eé]|anti-?âge|anti-?age|s[eé]rums?|toniques?|nettoyants?|contour|pattes d['’]oie/i.test(
      s,
    )
  ) {
    return "Visage";
  }
  if (
    /corps|bain|cellulite|jambes|solaire|autobronz|d[eé]odorant|gommage|peeling/i.test(
      s,
    )
  ) {
    return "Corps";
  }
  if (
    /huile|cr[eè]me|masque|savon|accessoire|parfum|enfant|ambiance|coussin|drap|sac |trousse|entretien|chien|diffuseur|boule|bille|spray|ampoule|baume|outil/i.test(
      s,
    )
  ) {
    return "autres";
  }
  if (s.endsWith("?") || /^diagnostique/i.test(s)) return "autres";
  return null;
}

export function brandsForProduct(
  name: string,
  categories: string[],
  extraBrands: string[] = [],
): string[] {
  const out = new Set<string>();
  const inferred = inferBrandFromProductName(name);
  if (inferred) out.add(inferred);
  for (const label of [...categories, ...extraBrands]) {
    const aliased = matchBrandAlias(label);
    if (aliased) out.add(aliased);
  }
  return uniqueSorted([...out]);
}

export function soinsForProduct(
  categories: string[],
  brands: string[],
): WooSoinsChild[] {
  const brandSet = new Set(brands.map((b) => b.toLowerCase()));
  const found = new Set<WooSoinsChild>();
  for (const cat of categories) {
    const decoded = decodeHtml(cat);
    if (!decoded) continue;
    if (brandSet.has(decoded.toLowerCase())) continue;
    if (matchBrandAlias(decoded)) continue;
    const child = soinsChildFromLabel(decoded);
    if (child) found.add(child);
  }
  const main = [...found].filter((child) => child !== "autres");
  if (main.length > 0) return main;
  return found.has("autres") ? ["autres"] : [];
}

export function collectWooCategoryNames(input: {
  name: string;
  categories?: Array<{ id?: number; name?: string } | string>;
  brands?: Array<{ name?: string } | string>;
  attributes?: Array<{ name?: string; options?: string[] }>;
  ancestorNames?: string[];
}): string[] {
  const names: string[] = [];
  for (const cat of input.categories ?? []) {
    const name = typeof cat === "string" ? cat : cat.name;
    if (name?.trim()) names.push(decodeHtml(name));
  }
  for (const ancestor of input.ancestorNames ?? []) {
    if (ancestor.trim()) names.push(decodeHtml(ancestor));
  }
  const extraBrands: string[] = [];
  for (const brand of input.brands ?? []) {
    const name = typeof brand === "string" ? brand : brand.name;
    if (name?.trim()) extraBrands.push(decodeHtml(name));
  }
  for (const attr of input.attributes ?? []) {
    if (!/marque|brand/i.test(attr.name ?? "")) continue;
    for (const option of attr.options ?? []) {
      if (option.trim()) extraBrands.push(decodeHtml(option));
    }
  }
  const brands = brandsForProduct(input.name, names, extraBrands);
  return uniqueSorted([...names, ...brands]);
}

export function classifyWooProduct(
  name: string,
  categories: string[],
): { brands: string[]; soins: WooSoinsChild[] } {
  const brands = brandsForProduct(name, categories);
  return { brands, soins: soinsForProduct(categories, brands) };
}
