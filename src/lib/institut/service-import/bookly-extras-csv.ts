import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type BooklyExtraCsvRow = {
  booklyExtraId: number;
  title: string;
  serviceBooklyId: number;
  serviceTitle: string;
  durationMin: number;
  priceCents: number;
  minQuantity: number;
  maxQuantity: number;
  sortOrder: number;
  imageUrl: string | null;
  lineNumber: number;
};

export type BooklyExtrasImportPreview = {
  totalRows: number;
  extrasToCreate: number;
  extrasReused: number;
  linksToCreate: number;
  linksToUpdate: number;
  linksMissingService: number;
  skipped: number;
  samples: {
    create: Array<{ title: string; serviceTitle: string; booklyExtraId: number }>;
  };
  errors: string[];
};

export type BooklyExtrasImportResult = {
  extrasCreated: number;
  extrasReused: number;
  linksCreated: number;
  linksUpdated: number;
  linksSkipped: number;
  errors: string[];
};

const REQUIRED_HEADERS = ["bookly_extra_id", "title", "service_id"] as const;

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function parseSemicolonCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ";") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      if (char === "\r") i += 1;
      continue;
    }

    if (char === "\r") continue;
    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

function parseIntSafe(value: string, fallback = 0): number {
  const n = Number.parseInt(value.replace(",", "."), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Détecte si le CSV est un export d'extras Bookly (colonne `bookly_extra_id`). */
export function isBooklyExtrasCsv(content: string): boolean {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return false;
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  const header = parseSemicolonCsv(firstLine)[0]?.map(normalizeHeader) ?? [];
  return header.includes("bookly_extra_id");
}

export function parseBooklyExtrasCsv(content: string): {
  rows: BooklyExtraCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { rows: [], errors: ["empty_file"] };

  const matrix = parseSemicolonCsv(trimmed);
  if (matrix.length < 2) return { rows: [], errors: ["empty_file"] };

  const header = matrix[0].map(normalizeHeader);
  const indexOf = (name: string) => header.findIndex((h) => h === name);

  const idx = {
    bookly_extra_id: indexOf("bookly_extra_id"),
    title: indexOf("title"),
    service_id: indexOf("service_id"),
    service_title: indexOf("service_title"),
    duration_min: indexOf("duration_min"),
    price_cents: indexOf("price_cents"),
    price: indexOf("price"),
    min_quantity: indexOf("min_quantity"),
    max_quantity: indexOf("max_quantity"),
    position: indexOf("position"),
    image_url: indexOf("image_url"),
  };

  for (const key of REQUIRED_HEADERS) {
    if (idx[key] < 0) {
      return { rows: [], errors: ["missing_columns"] };
    }
  }

  const rows: BooklyExtraCsvRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i];
    const booklyExtraId = parseIntSafe(cell(line, idx.bookly_extra_id), 0);
    const title = cell(line, idx.title);
    const serviceBooklyId = parseIntSafe(cell(line, idx.service_id), 0);
    if (!booklyExtraId || !title || !serviceBooklyId) {
      errors.push(`skip_line_${i + 1}`);
      continue;
    }

    let priceCents = parseIntSafe(cell(line, idx.price_cents), -1);
    if (priceCents < 0 && idx.price >= 0) {
      const euros = Number.parseFloat(cell(line, idx.price).replace(",", "."));
      priceCents = Number.isFinite(euros) ? Math.round(euros * 100) : 0;
    }
    if (priceCents < 0) priceCents = 0;

    rows.push({
      booklyExtraId,
      title,
      serviceBooklyId,
      serviceTitle: cell(line, idx.service_title),
      durationMin: Math.max(0, parseIntSafe(cell(line, idx.duration_min), 0)),
      priceCents,
      minQuantity: Math.max(0, parseIntSafe(cell(line, idx.min_quantity), 0)),
      maxQuantity: Math.max(1, parseIntSafe(cell(line, idx.max_quantity), 1)),
      sortOrder: parseIntSafe(cell(line, idx.position), i),
      imageUrl: cell(line, idx.image_url) || null,
      lineNumber: i + 1,
    });
  }

  return { rows, errors };
}

type ExistingService = {
  id: string;
  name: string;
  bookly_id: number | null;
  visibility: string;
};

type ExistingLink = {
  service_id: string;
  extra_service_id: string;
};

async function fetchExistingCatalog(supabase: Db, tenantId: string) {
  const [{ data: services }, { data: links }] = await Promise.all([
    supabase
      .from("inst_services")
      .select("id, name, bookly_id, visibility")
      .eq("tenant_id", tenantId),
    supabase
      .from("inst_service_extras")
      .select("service_id, extra_service_id")
      .eq("tenant_id", tenantId),
  ]);

  return {
    services: (services ?? []) as ExistingService[],
    links: (links ?? []) as ExistingLink[],
  };
}

/**
 * Preview côté client (également utilisable serveur). N'utilise pas Supabase :
 * on lui passe déjà les services + links existants.
 */
export function previewBooklyExtrasImport(
  rows: BooklyExtraCsvRow[],
  existing: { services: ExistingService[]; links: ExistingLink[] },
): BooklyExtrasImportPreview {
  const servicesByBookly = new Map(
    existing.services
      .filter((s) => s.bookly_id != null && s.visibility === "catalog")
      .map((s) => [s.bookly_id as number, s]),
  );
  const extrasByName = new Map(
    existing.services
      .filter((s) => s.visibility === "extra_only")
      .map((s) => [s.name.trim().toLowerCase(), s]),
  );
  const linkSet = new Set(existing.links.map((l) => `${l.service_id}:${l.extra_service_id}`));

  const uniqueExtras = new Map<string, BooklyExtraCsvRow>();
  const samples: BooklyExtrasImportPreview["samples"]["create"] = [];
  let linksToCreate = 0;
  let linksToUpdate = 0;
  let linksMissingService = 0;
  let skipped = 0;

  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    if (!key) {
      skipped += 1;
      continue;
    }
    if (!uniqueExtras.has(key)) {
      uniqueExtras.set(key, row);
      if (samples.length < 8) {
        samples.push({
          title: row.title,
          serviceTitle: row.serviceTitle,
          booklyExtraId: row.booklyExtraId,
        });
      }
    }

    const parentService = servicesByBookly.get(row.serviceBooklyId);
    if (!parentService) {
      linksMissingService += 1;
      continue;
    }

    const extraService = extrasByName.get(key);
    if (extraService) {
      const linkKey = `${parentService.id}:${extraService.id}`;
      if (linkSet.has(linkKey)) linksToUpdate += 1;
      else linksToCreate += 1;
    } else {
      linksToCreate += 1;
    }
  }

  let extrasToCreate = 0;
  let extrasReused = 0;
  for (const key of uniqueExtras.keys()) {
    if (extrasByName.has(key)) extrasReused += 1;
    else extrasToCreate += 1;
  }

  return {
    totalRows: rows.length,
    extrasToCreate,
    extrasReused,
    linksToCreate,
    linksToUpdate,
    linksMissingService,
    skipped,
    samples: { create: samples },
    errors: [],
  };
}

export async function fetchExistingExtrasCatalog(
  supabase: Db,
  tenantId: string,
): Promise<{ services: ExistingService[]; links: ExistingLink[] }> {
  return fetchExistingCatalog(supabase, tenantId);
}

export async function runBooklyExtrasImport(
  supabase: Db,
  tenantId: string,
  rows: BooklyExtraCsvRow[],
): Promise<BooklyExtrasImportResult> {
  const result: BooklyExtrasImportResult = {
    extrasCreated: 0,
    extrasReused: 0,
    linksCreated: 0,
    linksUpdated: 0,
    linksSkipped: 0,
    errors: [],
  };

  const existing = await fetchExistingCatalog(supabase, tenantId);
  const servicesByBookly = new Map(
    existing.services
      .filter((s) => s.bookly_id != null && s.visibility === "catalog")
      .map((s) => [s.bookly_id as number, s]),
  );
  const extrasByName = new Map(
    existing.services
      .filter((s) => s.visibility === "extra_only")
      .map((s) => [s.name.trim().toLowerCase(), s]),
  );

  // 1) Ensure every unique extra exists as an inst_services row with visibility=extra_only.
  const uniqueExtras = new Map<string, BooklyExtraCsvRow>();
  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    if (!key) continue;
    if (!uniqueExtras.has(key)) uniqueExtras.set(key, row);
  }

  const extraIdByName = new Map<string, string>();
  for (const [key, row] of uniqueExtras) {
    const found = extrasByName.get(key);
    if (found) {
      extraIdByName.set(key, found.id);
      result.extrasReused += 1;
      continue;
    }
    const { data, error } = await supabase
      .from("inst_services")
      .insert({
        tenant_id: tenantId,
        name: row.title,
        duration_min: Math.max(1, row.durationMin || 1),
        price_cents: row.priceCents,
        visibility: "extra_only",
        is_active: true,
        sort_order: row.sortOrder,
      })
      .select("id")
      .single();
    if (error || !data) {
      result.errors.push(`${row.title}: ${error?.message ?? "extra_insert_failed"}`);
      continue;
    }
    extraIdByName.set(key, data.id);
    result.extrasCreated += 1;
  }

  // 2) Create/update links between parent service and extra service.
  const existingLinks = new Map<string, ExistingLink>();
  for (const link of existing.links) {
    existingLinks.set(`${link.service_id}:${link.extra_service_id}`, link);
  }

  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    const extraId = extraIdByName.get(key);
    const parent = servicesByBookly.get(row.serviceBooklyId);
    if (!extraId || !parent) {
      result.linksSkipped += 1;
      continue;
    }
    if (parent.id === extraId) {
      result.linksSkipped += 1;
      continue;
    }

    const payload = {
      tenant_id: tenantId,
      service_id: parent.id,
      extra_service_id: extraId,
      min_qty: Math.max(0, row.minQuantity),
      max_qty: Math.max(1, row.maxQuantity),
      sort_order: row.sortOrder,
    };

    const linkKey = `${parent.id}:${extraId}`;
    if (existingLinks.has(linkKey)) {
      const { error } = await supabase
        .from("inst_service_extras")
        .update({
          min_qty: payload.min_qty,
          max_qty: payload.max_qty,
          sort_order: payload.sort_order,
        })
        .eq("service_id", parent.id)
        .eq("extra_service_id", extraId);
      if (error) {
        result.errors.push(`${row.title} → ${row.serviceTitle}: ${error.message}`);
        continue;
      }
      result.linksUpdated += 1;
    } else {
      const { error } = await supabase.from("inst_service_extras").insert(payload);
      if (error) {
        result.errors.push(`${row.title} → ${row.serviceTitle}: ${error.message}`);
        continue;
      }
      existingLinks.set(linkKey, { service_id: parent.id, extra_service_id: extraId });
      result.linksCreated += 1;
    }
  }

  return result;
}
