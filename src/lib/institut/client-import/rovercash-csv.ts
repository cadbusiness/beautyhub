import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import { ROVERCASH_IMPORT_TAG } from "@/lib/institut/client-import/constants";

export { ROVERCASH_IMPORT_TAG };

export type RovercashCsvRow = {
  reference: string;
  type: string;
  category: string;
  fullName: string;
  lastName: string;
  firstName: string;
  civility: string;
  phone: string;
  address: string;
  vatNumber: string;
  status: string;
  archived: string;
  createdAt: string | null;
  updatedAt: string | null;
  language: string;
  lineNumber: number;
};

export type RovercashImportRow = {
  reference: string;
  fullName: string;
  email: string;
  phone: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string | null;
  lineNumber: number;
};

export type RovercashImportPreview = {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  skipped: number;
  withPhone: number;
  duplicateRefsInFile: number;
  samples: {
    create: RovercashImportRow[];
    update: RovercashImportRow[];
    skipped: Array<{ lineNumber: number; reference: string; reason: string }>;
  };
  errors: string[];
};

export type RovercashImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type ExistingRovercashClient = {
  id: string;
  email: string;
  phone: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
};

const HEADER_ALIASES: Record<keyof Omit<RovercashCsvRow, "lineNumber">, string[]> = {
  reference: ["référence", "reference"],
  type: ["type"],
  category: ["catégorie client", "categorie client"],
  fullName: ["nom complet"],
  lastName: ["nom"],
  firstName: ["prénom", "prenom"],
  civility: ["civilité", "civilite"],
  phone: ["téléphone", "telephone"],
  address: ["adresse"],
  vatNumber: ["tva intracommunautaire", "tva"],
  status: ["état", "etat"],
  archived: ["archivé", "archive"],
  createdAt: ["date de création", "date de creation"],
  updatedAt: ["date de modification"],
  language: ["langue"],
};

function normalizeHeader(value: string): string {
  return value
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

function cleanCsvValue(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") return "";
  return trimmed;
}

function mapHeaders(headerRow: string[]): Partial<Record<keyof Omit<RovercashCsvRow, "lineNumber">, number>> {
  const normalized = headerRow.map(normalizeHeader);
  const mapping: Partial<Record<keyof Omit<RovercashCsvRow, "lineNumber">, number>> = {};

  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof Omit<RovercashCsvRow, "lineNumber">, string[]]
  >) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) mapping[key] = index;
  }

  return mapping;
}

export function parseRovercashCsv(content: string): {
  rows: RovercashCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { rows: [], errors: ["empty_file"] };

  const matrix = parseSemicolonCsv(trimmed);
  if (matrix.length < 2) {
    return { rows: [], errors: ["missing_rows"] };
  }

  const headers = mapHeaders(matrix[0] ?? []);
  if (headers.reference === undefined || headers.fullName === undefined) {
    return { rows: [], errors: ["missing_columns"] };
  }

  const rows: RovercashCsvRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    const get = (key: keyof Omit<RovercashCsvRow, "lineNumber">) =>
      cleanCsvValue(cells[headers[key] ?? -1]);

    rows.push({
      reference: get("reference"),
      type: get("type"),
      category: get("category"),
      fullName: get("fullName"),
      lastName: get("lastName"),
      firstName: get("firstName"),
      civility: get("civility"),
      phone: get("phone"),
      address: get("address"),
      vatNumber: get("vatNumber"),
      status: get("status"),
      archived: get("archived"),
      createdAt: get("createdAt") || null,
      updatedAt: get("updatedAt") || null,
      language: get("language"),
      lineNumber: i + 1,
    });
  }

  if (rows.length === 0) errors.push("no_data_rows");
  return { rows, errors };
}

export function normalizeBelgianPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  if (!digitsOnly) return null;

  let normalized = digitsOnly;
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (normalized.startsWith("+32")) {
    const rest = normalized.slice(3).replace(/\D/g, "");
    if (rest.length >= 8) return `+32 ${rest}`;
    return normalized;
  }
  if (normalized.startsWith("32") && normalized.length >= 10) {
    return `+32 ${normalized.slice(2)}`;
  }
  if (normalized.startsWith("0")) {
    const withoutZero = normalized.replace(/\D/g, "").slice(1);
    if (withoutZero.length >= 8) return `+32 ${withoutZero}`;
  }

  return trimmed.replace(/\s+/g, " ").trim();
}

export function rovercashImportEmail(reference: string, tenantSlug: string): string {
  const ref = reference.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const slug = tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "tenant";
  return `${ref}@import.${slug}.local`;
}

export function isGeneratedImportEmail(email: string, tenantSlug: string): boolean {
  const suffix = `@import.${tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "tenant"}.local`;
  return email.toLowerCase().endsWith(suffix);
}

function parseRovercashDate(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function skipReason(row: RovercashCsvRow): string | null {
  if (!row.reference) return "missing_reference";
  if (!row.fullName) return "missing_name";
  if (row.type.toLowerCase() === "professionnel") return "professional";
  if (row.archived && row.archived.toLowerCase() !== "actif") return "archived";
  return null;
}

function buildImportRow(row: RovercashCsvRow, tenantSlug: string): RovercashImportRow {
  const phone = normalizeBelgianPhone(row.phone);
  const metadata: Record<string, unknown> = {
    rovercash_ref: row.reference,
    import_source: "rovercash",
    imported_email: true,
    rovercash_type: row.type || null,
    rovercash_category: row.category || null,
    rovercash_civility: row.civility || null,
    rovercash_language: row.language || null,
  };

  if (row.vatNumber) metadata.rovercash_vat = row.vatNumber;

  const tags = [ROVERCASH_IMPORT_TAG];
  if (row.category && row.category !== "Client standard") {
    tags.push(row.category);
  }

  return {
    reference: row.reference,
    fullName: row.fullName,
    email: rovercashImportEmail(row.reference, tenantSlug),
    phone,
    tags: tags.slice(0, 10),
    metadata,
    createdAt: parseRovercashDate(row.createdAt),
    lineNumber: row.lineNumber,
  };
}

export function previewRovercashImport(
  csvRows: RovercashCsvRow[],
  tenantSlug: string,
  existingRefs: Set<string> | Map<string, ExistingRovercashClient>,
): RovercashImportPreview {
  const seenRefs = new Set<string>();
  let duplicateRefsInFile = 0;
  let toCreate = 0;
  let toUpdate = 0;
  let skipped = 0;
  let withPhone = 0;

  const createSamples: RovercashImportRow[] = [];
  const updateSamples: RovercashImportRow[] = [];
  const skippedSamples: Array<{ lineNumber: number; reference: string; reason: string }> = [];

  for (const row of csvRows) {
    const reason = skipReason(row);
    if (reason) {
      skipped += 1;
      if (skippedSamples.length < 5) {
        skippedSamples.push({
          lineNumber: row.lineNumber,
          reference: row.reference || "—",
          reason,
        });
      }
      continue;
    }

    if (seenRefs.has(row.reference)) {
      duplicateRefsInFile += 1;
      skipped += 1;
      if (skippedSamples.length < 5) {
        skippedSamples.push({
          lineNumber: row.lineNumber,
          reference: row.reference,
          reason: "duplicate_ref",
        });
      }
      continue;
    }
    seenRefs.add(row.reference);

    const mapped = buildImportRow(row, tenantSlug);
    if (mapped.phone) withPhone += 1;

    if (existingRefs.has(row.reference)) {
      toUpdate += 1;
      if (updateSamples.length < 5) updateSamples.push(mapped);
    } else {
      toCreate += 1;
      if (createSamples.length < 5) createSamples.push(mapped);
    }
  }

  return {
    totalRows: csvRows.length,
    toCreate,
    toUpdate,
    skipped,
    withPhone,
    duplicateRefsInFile,
    samples: {
      create: createSamples,
      update: updateSamples,
      skipped: skippedSamples,
    },
    errors: [],
  };
}

export function mapExistingRovercashClients(
  rows: Array<{
    id: string;
    email: string;
    phone: string | null;
    metadata: unknown;
    tags: string[] | null;
  }>,
): Map<string, ExistingRovercashClient> {
  const map = new Map<string, ExistingRovercashClient>();
  for (const row of rows) {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const ref =
      typeof metadata.rovercash_ref === "string"
        ? metadata.rovercash_ref
        : typeof metadata.overcache_ref === "string"
          ? metadata.overcache_ref
          : null;
    if (!ref) continue;
    map.set(ref, {
      id: row.id,
      email: row.email,
      phone: row.phone,
      metadata,
      tags: row.tags ?? [],
    });
  }
  return map;
}

type Db = SupabaseClient<Database>;

const BATCH_SIZE = 150;

export async function fetchExistingRovercashClients(
  supabase: Db,
  tenantId: string,
): Promise<Map<string, ExistingRovercashClient>> {
  const rows: Array<{
    id: string;
    email: string;
    phone: string | null;
    metadata: unknown;
    tags: string[] | null;
  }> = [];

  let from = 0;
  const pageSize = 1000;
  while (from < 20_000) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, email, phone, metadata, tags")
      .eq("tenant_id", tenantId)
      .or(`tags.cs.{"Rovercash"},tags.cs.{"Overcache"}`)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("[fetchExistingRovercashClients]", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return mapExistingRovercashClients(rows);
}

export async function runRovercashImport(
  supabase: Db,
  tenantId: string,
  tenantSlug: string,
  csvRows: RovercashCsvRow[],
  options: { limit?: number } = {},
): Promise<RovercashImportResult> {
  const existingByRef = await fetchExistingRovercashClients(supabase, tenantId);
  const preview = previewRovercashImport(csvRows, tenantSlug, existingByRef);

  const seenRefs = new Set<string>();
  const toInsert: Database["public"]["Tables"]["clients"]["Insert"][] = [];
  const toUpdate: Array<{
    id: string;
    patch: Database["public"]["Tables"]["clients"]["Update"];
  }> = [];

  for (const row of csvRows) {
    const reason = skipReason(row);
    if (reason) continue;
    if (seenRefs.has(row.reference)) continue;
    seenRefs.add(row.reference);

    if (options.limit && toInsert.length + toUpdate.length >= options.limit) break;

    const mapped = buildImportRow(row, tenantSlug);
    const existing = existingByRef.get(row.reference);

    if (existing) {
      const mergedTags = [...new Set([...existing.tags, ...mapped.tags])].slice(0, 10);
      const keepEmail =
        !isGeneratedImportEmail(existing.email, tenantSlug) ? existing.email : mapped.email;
      const phone = mapped.phone ?? existing.phone;

      toUpdate.push({
        id: existing.id,
        patch: {
          full_name: mapped.fullName,
          email: keepEmail,
          phone,
          tags: mergedTags,
          metadata: { ...existing.metadata, ...mapped.metadata } as Json,
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      const insertRow: Database["public"]["Tables"]["clients"]["Insert"] = {
        tenant_id: tenantId,
        full_name: mapped.fullName,
        email: mapped.email,
        phone: mapped.phone,
        tags: mapped.tags,
        metadata: mapped.metadata as Json,
        marketing_opt_in: false,
      };
      if (mapped.createdAt) insertRow.created_at = mapped.createdAt;
      toInsert.push(insertRow);
    }
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("clients").insert(batch);
    if (error) {
      errors.push(error.message);
      break;
    }
    created += batch.length;
  }

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(({ id, patch }) =>
        supabase.from("clients").update(patch).eq("tenant_id", tenantId).eq("id", id),
      ),
    );
    for (const result of results) {
      if (result.error) {
        errors.push(result.error.message);
      } else {
        updated += 1;
      }
    }
  }

  return {
    created,
    updated,
    skipped: preview.skipped,
    errors,
  };
}
