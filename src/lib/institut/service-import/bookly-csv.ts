import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type BooklyServiceCsvRow = {
  booklyId: number;
  title: string;
  categoryId: number | null;
  categoryName: string;
  durationMin: number;
  priceCents: number;
  color: string | null;
  visibility: "catalog" | "extra_only";
  isActive: boolean;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  description: string | null;
  sortOrder: number;
  lineNumber: number;
};

export type BooklyImportPreview = {
  totalRows: number;
  categoriesToCreate: number;
  categoriesToUpdate: number;
  servicesToCreate: number;
  servicesToUpdate: number;
  skipped: number;
  samples: {
    create: Array<{ title: string; categoryName: string; booklyId: number }>;
    update: Array<{ title: string; categoryName: string; booklyId: number }>;
    categories: string[];
  };
  errors: string[];
};

export type BooklyImportResult = {
  categoriesCreated: number;
  categoriesUpdated: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

const REQUIRED_HEADERS = ["bookly_id", "title", "duration_min", "price_cents"] as const;

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

function mapBooklyVisibility(raw: string): { visibility: "catalog" | "extra_only"; isActive: boolean } {
  const v = raw.trim().toLowerCase();
  if (v === "private" || v === "group") {
    return { visibility: "catalog", isActive: false };
  }
  return { visibility: "catalog", isActive: true };
}

export function parseBooklyServicesCsv(content: string): {
  rows: BooklyServiceCsvRow[];
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
    bookly_id: indexOf("bookly_id"),
    title: indexOf("title"),
    category_id: indexOf("category_id"),
    category_name: indexOf("category_name"),
    duration_min: indexOf("duration_min"),
    price_cents: indexOf("price_cents"),
    price: indexOf("price"),
    color: indexOf("color"),
    visibility: indexOf("visibility"),
    buffer_before_min: indexOf("buffer_before_min"),
    buffer_after_min: indexOf("buffer_after_min"),
    info: indexOf("info"),
    position: indexOf("position"),
  };

  for (const key of REQUIRED_HEADERS) {
    if (idx[key] < 0) {
      return { rows: [], errors: ["missing_columns"] };
    }
  }

  const rows: BooklyServiceCsvRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i];
    const booklyId = parseIntSafe(cell(line, idx.bookly_id), 0);
    const title = cell(line, idx.title);
    if (!booklyId || !title) {
      errors.push(`skip_line_${i + 1}`);
      continue;
    }

    let priceCents = parseIntSafe(cell(line, idx.price_cents), -1);
    if (priceCents < 0 && idx.price >= 0) {
      const euros = Number.parseFloat(cell(line, idx.price).replace(",", "."));
      priceCents = Number.isFinite(euros) ? Math.round(euros * 100) : 0;
    }
    if (priceCents < 0) priceCents = 0;

    const catIdRaw = cell(line, idx.category_id);
    const categoryId = catIdRaw ? parseIntSafe(catIdRaw, 0) || null : null;
    const categoryName = cell(line, idx.category_name).replace(/^\u00b0\s*/, "").trim();
    const vis = mapBooklyVisibility(cell(line, idx.visibility));
    const description = cell(line, idx.info) || null;

    rows.push({
      booklyId,
      title,
      categoryId,
      categoryName,
      durationMin: Math.max(1, parseIntSafe(cell(line, idx.duration_min), 30)),
      priceCents,
      color: cell(line, idx.color) || null,
      visibility: vis.visibility,
      isActive: vis.isActive,
      bufferBeforeMin: Math.max(0, parseIntSafe(cell(line, idx.buffer_before_min), 0)),
      bufferAfterMin: Math.max(0, parseIntSafe(cell(line, idx.buffer_after_min), 0)),
      description,
      sortOrder: parseIntSafe(cell(line, idx.position), i),
      lineNumber: i + 1,
    });
  }

  return { rows, errors };
}

export async function fetchExistingBooklyCatalog(supabase: Db, tenantId: string) {
  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase
      .from("inst_service_categories")
      .select("id, name, bookly_id, sort_order")
      .eq("tenant_id", tenantId),
    supabase
      .from("inst_services")
      .select("id, name, bookly_id, category_id")
      .eq("tenant_id", tenantId),
  ]);

  return {
    categories: categories ?? [],
    services: services ?? [],
  };
}

export function previewBooklyImport(
  rows: BooklyServiceCsvRow[],
  existing: Awaited<ReturnType<typeof fetchExistingBooklyCatalog>>,
): BooklyImportPreview {
  const byBooklyService = new Map(
    existing.services
      .filter((s) => s.bookly_id != null)
      .map((s) => [s.bookly_id as number, s]),
  );
  const byBooklyCategory = new Map(
    existing.categories
      .filter((c) => c.bookly_id != null)
      .map((c) => [c.bookly_id as number, c]),
  );
  const byCategoryName = new Map(
    existing.categories.map((c) => [c.name.trim().toLowerCase(), c]),
  );

  const categoryKeys = new Map<string, { booklyId: number | null; name: string }>();
  for (const row of rows) {
    if (!row.categoryName && row.categoryId == null) continue;
    const key =
      row.categoryId != null
        ? `id:${row.categoryId}`
        : `name:${row.categoryName.toLowerCase()}`;
    if (!categoryKeys.has(key)) {
      categoryKeys.set(key, {
        booklyId: row.categoryId,
        name: row.categoryName || `Categorie ${row.categoryId}`,
      });
    }
  }

  let categoriesToCreate = 0;
  let categoriesToUpdate = 0;
  const categoryNames: string[] = [];
  for (const cat of categoryKeys.values()) {
    categoryNames.push(cat.name);
    const found =
      (cat.booklyId != null ? byBooklyCategory.get(cat.booklyId) : undefined) ??
      byCategoryName.get(cat.name.toLowerCase());
    if (found) categoriesToUpdate += 1;
    else categoriesToCreate += 1;
  }

  let servicesToCreate = 0;
  let servicesToUpdate = 0;
  const samplesCreate: BooklyImportPreview["samples"]["create"] = [];
  const samplesUpdate: BooklyImportPreview["samples"]["update"] = [];

  const seen = new Set<number>();
  let skipped = 0;
  for (const row of rows) {
    if (seen.has(row.booklyId)) {
      skipped += 1;
      continue;
    }
    seen.add(row.booklyId);
    const existingService = byBooklyService.get(row.booklyId);
    const sample = {
      title: row.title,
      categoryName: row.categoryName,
      booklyId: row.booklyId,
    };
    if (existingService) {
      servicesToUpdate += 1;
      if (samplesUpdate.length < 8) samplesUpdate.push(sample);
    } else {
      servicesToCreate += 1;
      if (samplesCreate.length < 8) samplesCreate.push(sample);
    }
  }

  return {
    totalRows: rows.length,
    categoriesToCreate,
    categoriesToUpdate,
    servicesToCreate,
    servicesToUpdate,
    skipped,
    samples: {
      create: samplesCreate,
      update: samplesUpdate,
      categories: categoryNames.slice(0, 20),
    },
    errors: [],
  };
}

export async function runBooklyServicesImport(
  supabase: Db,
  tenantId: string,
  rows: BooklyServiceCsvRow[],
): Promise<BooklyImportResult> {
  const result: BooklyImportResult = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const existing = await fetchExistingBooklyCatalog(supabase, tenantId);
  const byBooklyCategory = new Map(
    existing.categories
      .filter((c) => c.bookly_id != null)
      .map((c) => [c.bookly_id as number, c]),
  );
  const byCategoryName = new Map(
    existing.categories.map((c) => [c.name.trim().toLowerCase(), c]),
  );
  const byBooklyService = new Map(
    existing.services
      .filter((s) => s.bookly_id != null)
      .map((s) => [s.bookly_id as number, s]),
  );

  // Categories first (stable sort by bookly id)
  const categoryDefs = new Map<
    string,
    { booklyId: number | null; name: string; sortOrder: number }
  >();
  for (const row of rows) {
    if (!row.categoryName && row.categoryId == null) continue;
    const key =
      row.categoryId != null
        ? `id:${row.categoryId}`
        : `name:${row.categoryName.toLowerCase()}`;
    if (!categoryDefs.has(key)) {
      categoryDefs.set(key, {
        booklyId: row.categoryId,
        name: row.categoryName || `Categorie ${row.categoryId}`,
        sortOrder: row.categoryId ?? 999,
      });
    }
  }

  const categoryIdByKey = new Map<string, string>();

  for (const [key, def] of [...categoryDefs.entries()].sort(
    (a, b) => a[1].sortOrder - b[1].sortOrder,
  )) {
    const found =
      (def.booklyId != null ? byBooklyCategory.get(def.booklyId) : undefined) ??
      byCategoryName.get(def.name.toLowerCase());

    if (found) {
      const { error } = await supabase
        .from("inst_service_categories")
        .update({
          name: def.name,
          sort_order: def.sortOrder,
          bookly_id: def.booklyId,
        })
        .eq("id", found.id);
      if (error) {
        result.errors.push(error.message);
        continue;
      }
      categoryIdByKey.set(key, found.id);
      result.categoriesUpdated += 1;
    } else {
      const { data, error } = await supabase
        .from("inst_service_categories")
        .insert({
          tenant_id: tenantId,
          name: def.name,
          sort_order: def.sortOrder,
          bookly_id: def.booklyId,
        })
        .select("id")
        .single();
      if (error || !data) {
        result.errors.push(error?.message ?? "category_insert_failed");
        continue;
      }
      categoryIdByKey.set(key, data.id);
      byCategoryName.set(def.name.toLowerCase(), {
        id: data.id,
        name: def.name,
        bookly_id: def.booklyId,
        sort_order: def.sortOrder,
      });
      if (def.booklyId != null) {
        byBooklyCategory.set(def.booklyId, {
          id: data.id,
          name: def.name,
          bookly_id: def.booklyId,
          sort_order: def.sortOrder,
        });
      }
      result.categoriesCreated += 1;
    }
  }

  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.booklyId)) {
      result.skipped += 1;
      continue;
    }
    seen.add(row.booklyId);

    const catKey =
      row.categoryId != null
        ? `id:${row.categoryId}`
        : row.categoryName
          ? `name:${row.categoryName.toLowerCase()}`
          : null;
    const categoryId = catKey ? (categoryIdByKey.get(catKey) ?? null) : null;

    const payload = {
      name: row.title,
      description: row.description,
      duration_min: row.durationMin,
      price_cents: row.priceCents,
      color: row.color,
      visibility: row.visibility,
      is_active: row.isActive,
      buffer_before_min: row.bufferBeforeMin,
      buffer_after_min: row.bufferAfterMin,
      category_id: categoryId,
      sort_order: row.sortOrder,
      bookly_id: row.booklyId,
    };

    const existingService = byBooklyService.get(row.booklyId);
    if (existingService) {
      const { error } = await supabase
        .from("inst_services")
        .update(payload)
        .eq("id", existingService.id);
      if (error) {
        result.errors.push(`${row.title}: ${error.message}`);
        continue;
      }
      result.updated += 1;
    } else {
      const { error } = await supabase.from("inst_services").insert({
        tenant_id: tenantId,
        ...payload,
      });
      if (error) {
        result.errors.push(`${row.title}: ${error.message}`);
        continue;
      }
      result.created += 1;
    }
  }

  return result;
}
