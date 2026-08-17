import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { findOrCreateClientFromExternal, normalizeName } from "@/lib/institut/clients-dedup";
import { syncAppointmentExtras } from "@/lib/institut/appointment-extras";
import type { BookingExtraLine } from "@/lib/institut/service-extras";

type Db = SupabaseClient<Database>;
type AppointmentStatus = "booked" | "confirmed" | "completed" | "cancelled" | "no_show";

export type BooklyAppointmentExtra = {
  booklyExtraId: number;
  title: string;
  quantity: number;
  durationMin: number;
  priceCents: number;
};

export type BooklyAppointmentCsvRow = {
  booklyCaId: number;
  booklyAppointmentId: number;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus | "skip";
  serviceBooklyId: number;
  serviceTitle: string;
  staffBooklyId: number | null;
  staffName: string;
  customerBooklyId: number | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerFullName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  priceCents: number | null;
  extras: BooklyAppointmentExtra[];
  lineNumber: number;
};

export type BooklyAppointmentCatalog = {
  services: Array<{ id: string; name: string; bookly_id: number | null; visibility: string }>;
  staff: Array<{ id: string; full_name: string; bookly_id: number | null }>;
  extras: Array<{
    extra_service_id: string;
    service_id: string;
    name: string;
  }>;
  existingAppointments: Array<{ id: string; bookly_id: number }>;
};

export type BooklyAppointmentImportPreview = {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  skipped: number;
  missingService: number;
  unmatchedStaff: number;
  upcoming: number;
  past: number;
  samples: Array<{
    startsAt: string;
    serviceTitle: string;
    clientName: string;
    staffName: string;
  }>;
  unmatchedStaffNames: string[];
  missingServiceTitles: string[];
  errors: string[];
};

export type BooklyAppointmentImportResult = {
  created: number;
  updated: number;
  skipped: number;
  cancelled: number;
  clientsCreated: number;
  unmatchedStaff: number;
  missingService: number;
  errors: string[];
};

const REQUIRED_HEADERS = ["bookly_ca_id", "starts_at", "service_bookly_id"] as const;

const STATUS_MAP: Record<string, AppointmentStatus | "skip"> = {
  pending: "booked",
  approved: "confirmed",
  confirmed: "confirmed",
  booked: "booked",
  cancelled: "cancelled",
  canceled: "cancelled",
  rejected: "cancelled",
  done: "completed",
  completed: "completed",
  waitlisted: "skip",
  waiting: "skip",
  skip: "skip",
  "no-show": "no_show",
  noshow: "no_show",
  no_show: "no_show",
};

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

function emptyToNull(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

function mapStatus(raw: string): AppointmentStatus | "skip" {
  const v = raw.trim().toLowerCase();
  if (!v) return "booked";
  return STATUS_MAP[v] ?? "booked";
}

function parseExtrasJson(raw: string): BooklyAppointmentExtra[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const booklyExtraId = Number(o.bookly_extra_id ?? o.booklyExtraId ?? 0);
      const quantity = Math.max(1, Number(o.quantity) || 1);
      if (!title && !booklyExtraId) return [];
      return [
        {
          booklyExtraId: Number.isFinite(booklyExtraId) ? booklyExtraId : 0,
          title,
          quantity,
          durationMin: Math.max(0, Number(o.duration_min ?? o.durationMin) || 0),
          priceCents: Math.max(0, Number(o.price_cents ?? o.priceCents) || 0),
        },
      ];
    });
  } catch {
    return [];
  }
}

function splitCustomerName(row: {
  customerFirstName: string | null;
  customerLastName: string | null;
  customerFullName: string | null;
}): { firstName: string | null; lastName: string | null } {
  const first = row.customerFirstName?.trim() || null;
  const last = row.customerLastName?.trim() || null;
  if (first || last) return { firstName: first, lastName: last };
  const full = row.customerFullName?.trim() || "";
  if (!full) return { firstName: null, lastName: null };
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") };
}

export function isBooklyAppointmentsCsv(content: string): boolean {
  const firstLine = content.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const header = firstLine.split(";").map(normalizeHeader);
  return header.includes("bookly_ca_id") || header.includes("bookly_appointment_id");
}

export function isBooklyAppointmentsJson(content: string): boolean {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { appointments?: unknown }).appointments)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function toRowFromObject(raw: unknown, lineNumber: number): BooklyAppointmentCsvRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback = 0): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") return parseIntSafe(v, fallback);
    return fallback;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

  const booklyCaId = num(r.bookly_ca_id ?? r.booklyCaId, 0);
  const startsAt = str(r.starts_at ?? r.startsAt);
  const serviceBooklyId = num(r.service_bookly_id ?? r.serviceBooklyId, 0);
  if (!booklyCaId || !startsAt || !serviceBooklyId) return null;

  let extras: BooklyAppointmentExtra[] = [];
  if (Array.isArray(r.extras)) {
    extras = parseExtrasJson(JSON.stringify(r.extras));
  } else if (typeof r.extras_json === "string") {
    extras = parseExtrasJson(r.extras_json);
  }

  const priceRaw = r.price_cents ?? r.priceCents;
  const priceCents =
    priceRaw == null || priceRaw === ""
      ? null
      : Math.max(0, num(priceRaw, 0));

  return {
    booklyCaId,
    booklyAppointmentId: num(r.bookly_appointment_id ?? r.booklyAppointmentId, 0),
    startsAt,
    endsAt: str(r.ends_at ?? r.endsAt),
    status: mapStatus(str(r.status ?? r.bookly_status ?? r.booklyStatus)),
    serviceBooklyId,
    serviceTitle: str(r.service_title ?? r.serviceTitle),
    staffBooklyId: num(r.staff_bookly_id ?? r.staffBooklyId, 0) || null,
    staffName: str(r.staff_name ?? r.staffName),
    customerBooklyId: num(r.customer_bookly_id ?? r.customerBooklyId, 0) || null,
    customerFirstName: emptyToNull(str(r.customer_first_name ?? r.customerFirstName)),
    customerLastName: emptyToNull(str(r.customer_last_name ?? r.customerLastName)),
    customerFullName: emptyToNull(str(r.customer_full_name ?? r.customerFullName)),
    customerEmail: emptyToNull(str(r.customer_email ?? r.customerEmail)),
    customerPhone: emptyToNull(str(r.customer_phone ?? r.customerPhone)),
    notes: emptyToNull(str(r.notes)),
    priceCents,
    extras,
    lineNumber,
  };
}

export function parseBooklyAppointmentsJson(content: string): {
  rows: BooklyAppointmentCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(content.replace(/^\uFEFF/, "").trim()) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? ((parsed as { appointments?: unknown }).appointments ?? [])
        : [];
    if (!Array.isArray(list)) return { rows: [], errors: ["invalid_json"] };
    const rows: BooklyAppointmentCsvRow[] = [];
    for (let i = 0; i < list.length; i += 1) {
      const row = toRowFromObject(list[i], i + 1);
      if (row) rows.push(row);
      else errors.push(`skip_item_${i + 1}`);
    }
    return { rows, errors };
  } catch {
    return { rows: [], errors: ["invalid_json"] };
  }
}

export function parseBooklyAppointmentsCsv(content: string): {
  rows: BooklyAppointmentCsvRow[];
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
    bookly_ca_id: indexOf("bookly_ca_id"),
    bookly_appointment_id: indexOf("bookly_appointment_id"),
    starts_at: indexOf("starts_at"),
    ends_at: indexOf("ends_at"),
    status: indexOf("status"),
    bookly_status: indexOf("bookly_status"),
    service_bookly_id: indexOf("service_bookly_id"),
    service_title: indexOf("service_title"),
    staff_bookly_id: indexOf("staff_bookly_id"),
    staff_name: indexOf("staff_name"),
    customer_bookly_id: indexOf("customer_bookly_id"),
    customer_first_name: indexOf("customer_first_name"),
    customer_last_name: indexOf("customer_last_name"),
    customer_full_name: indexOf("customer_full_name"),
    customer_email: indexOf("customer_email"),
    customer_phone: indexOf("customer_phone"),
    notes: indexOf("notes"),
    price_cents: indexOf("price_cents"),
    extras_json: indexOf("extras_json"),
  };

  for (const key of REQUIRED_HEADERS) {
    if (idx[key] < 0) return { rows: [], errors: ["missing_columns"] };
  }

  const rows: BooklyAppointmentCsvRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i];
    const booklyCaId = parseIntSafe(cell(line, idx.bookly_ca_id), 0);
    const startsAt = cell(line, idx.starts_at);
    const serviceBooklyId = parseIntSafe(cell(line, idx.service_bookly_id), 0);
    if (!booklyCaId || !startsAt || !serviceBooklyId) {
      errors.push(`skip_line_${i + 1}`);
      continue;
    }
    const priceRaw = cell(line, idx.price_cents);
    rows.push({
      booklyCaId,
      booklyAppointmentId: parseIntSafe(cell(line, idx.bookly_appointment_id), 0),
      startsAt,
      endsAt: cell(line, idx.ends_at),
      status: mapStatus(cell(line, idx.status) || cell(line, idx.bookly_status)),
      serviceBooklyId,
      serviceTitle: cell(line, idx.service_title),
      staffBooklyId: parseIntSafe(cell(line, idx.staff_bookly_id), 0) || null,
      staffName: cell(line, idx.staff_name),
      customerBooklyId: parseIntSafe(cell(line, idx.customer_bookly_id), 0) || null,
      customerFirstName: emptyToNull(cell(line, idx.customer_first_name)),
      customerLastName: emptyToNull(cell(line, idx.customer_last_name)),
      customerFullName: emptyToNull(cell(line, idx.customer_full_name)),
      customerEmail: emptyToNull(cell(line, idx.customer_email)),
      customerPhone: emptyToNull(cell(line, idx.customer_phone)),
      notes: emptyToNull(cell(line, idx.notes)),
      priceCents: priceRaw === "" ? null : Math.max(0, parseIntSafe(priceRaw, 0)),
      extras: parseExtrasJson(cell(line, idx.extras_json)),
      lineNumber: i + 1,
    });
  }

  return { rows, errors };
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function filterUpcomingRows(
  rows: BooklyAppointmentCsvRow[],
  upcomingOnly: boolean,
): BooklyAppointmentCsvRow[] {
  if (!upcomingOnly) return rows;
  const cutoff = startOfToday().getTime();
  return rows.filter((row) => {
    const t = Date.parse(row.startsAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

export function previewBooklyAppointmentsImport(
  rows: BooklyAppointmentCsvRow[],
  catalog: BooklyAppointmentCatalog,
  upcomingOnly: boolean,
): BooklyAppointmentImportPreview {
  const filtered = filterUpcomingRows(rows, upcomingOnly);
  const servicesByBookly = new Map(
    catalog.services
      .filter((s) => s.bookly_id != null)
      .map((s) => [s.bookly_id as number, s]),
  );
  const staffByBookly = new Map(
    catalog.staff.filter((s) => s.bookly_id != null).map((s) => [s.bookly_id as number, s]),
  );
  const staffByName = new Map(
    catalog.staff.map((s) => [normalizeName(s.full_name) ?? "", s]),
  );
  const existing = new Set(catalog.existingAppointments.map((a) => a.bookly_id));
  const cutoff = startOfToday().getTime();

  let toCreate = 0;
  let toUpdate = 0;
  let skipped = 0;
  let missingService = 0;
  let unmatchedStaff = 0;
  let upcoming = 0;
  let past = 0;
  const unmatchedStaffNames = new Set<string>();
  const missingServiceTitles = new Set<string>();
  const samples: BooklyAppointmentImportPreview["samples"] = [];

  const seen = new Set<number>();
  for (const row of filtered) {
    const startMs = Date.parse(row.startsAt);
    if (Number.isFinite(startMs) && startMs >= cutoff) upcoming += 1;
    else past += 1;

    if (seen.has(row.booklyCaId) || row.status === "skip") {
      skipped += 1;
      continue;
    }
    seen.add(row.booklyCaId);

    if (!servicesByBookly.has(row.serviceBooklyId)) {
      missingService += 1;
      missingServiceTitles.add(row.serviceTitle || `#${row.serviceBooklyId}`);
      continue;
    }

    const staffMatch =
      (row.staffBooklyId != null ? staffByBookly.get(row.staffBooklyId) : undefined) ??
      (row.staffName ? staffByName.get(normalizeName(row.staffName) ?? "") : undefined);
    if (row.staffName && !staffMatch) {
      unmatchedStaff += 1;
      unmatchedStaffNames.add(row.staffName);
    }

    if (existing.has(row.booklyCaId)) toUpdate += 1;
    else toCreate += 1;

    if (samples.length < 8) {
      samples.push({
        startsAt: row.startsAt,
        serviceTitle: row.serviceTitle,
        clientName:
          row.customerFullName ||
          [row.customerFirstName, row.customerLastName].filter(Boolean).join(" ") ||
          row.customerEmail ||
          "—",
        staffName: row.staffName || "—",
      });
    }
  }

  return {
    totalRows: filtered.length,
    toCreate,
    toUpdate,
    skipped,
    missingService,
    unmatchedStaff,
    upcoming,
    past,
    samples,
    unmatchedStaffNames: [...unmatchedStaffNames].slice(0, 12),
    missingServiceTitles: [...missingServiceTitles].slice(0, 12),
    errors: [],
  };
}

export async function fetchBooklyAppointmentCatalog(
  supabase: Db,
  tenantId: string,
): Promise<BooklyAppointmentCatalog> {
  const [{ data: services }, { data: staff }, { data: extraLinks }, { data: existing }] =
    await Promise.all([
      supabase
        .from("inst_services")
        .select("id, name, bookly_id, visibility")
        .eq("tenant_id", tenantId),
      supabase.from("inst_staff").select("id, full_name, bookly_id").eq("tenant_id", tenantId),
      supabase
        .from("inst_service_extras")
        .select("service_id, extra_service_id")
        .eq("tenant_id", tenantId),
      supabase
        .from("inst_appointments")
        .select("id, bookly_id")
        .eq("tenant_id", tenantId)
        .not("bookly_id", "is", null),
    ]);

  const extraIds = [...new Set((extraLinks ?? []).map((l) => l.extra_service_id))];
  const extraNameById = new Map<string, string>();
  if (extraIds.length) {
    const { data: extraServices } = await supabase
      .from("inst_services")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", extraIds);
    for (const s of extraServices ?? []) extraNameById.set(s.id, s.name);
  }

  const extras = (extraLinks ?? []).flatMap((link) => {
    const name = extraNameById.get(link.extra_service_id);
    if (!name) return [];
    return [
      {
        extra_service_id: link.extra_service_id,
        service_id: link.service_id,
        name,
      },
    ];
  });

  return {
    services: services ?? [],
    staff: staff ?? [],
    extras,
    existingAppointments: (existing ?? []).flatMap((a) =>
      typeof a.bookly_id === "number" ? [{ id: a.id, bookly_id: a.bookly_id }] : [],
    ),
  };
}

function resolveStaffId(
  row: BooklyAppointmentCsvRow,
  staffByBookly: Map<number, { id: string; full_name: string; bookly_id: number | null }>,
  staffByName: Map<string, { id: string; full_name: string; bookly_id: number | null }>,
): { id: string | null; unmatched: boolean } {
  if (row.staffBooklyId != null) {
    const byId = staffByBookly.get(row.staffBooklyId);
    if (byId) return { id: byId.id, unmatched: false };
  }
  const key = normalizeName(row.staffName);
  if (key) {
    const byName = staffByName.get(key);
    if (byName) return { id: byName.id, unmatched: false };
  }
  return { id: null, unmatched: Boolean(row.staffName) };
}

function resolveExtras(
  row: BooklyAppointmentCsvRow,
  parentServiceId: string,
  extras: BooklyAppointmentCatalog["extras"],
): BookingExtraLine[] {
  if (!row.extras.length) return [];
  const linked = extras.filter((e) => e.service_id === parentServiceId);
  const byName = new Map(linked.map((e) => [e.name.trim().toLowerCase(), e]));
  const fallbackByName = new Map(extras.map((e) => [e.name.trim().toLowerCase(), e]));
  const out: BookingExtraLine[] = [];
  for (const extra of row.extras) {
    const key = extra.title.trim().toLowerCase();
    const match = (key && byName.get(key)) || (key && fallbackByName.get(key));
    if (!match) continue;
    out.push({ service_id: match.extra_service_id, quantity: extra.quantity });
  }
  return out;
}

export async function runBooklyAppointmentsImport(
  supabase: Db,
  tenantId: string,
  rows: BooklyAppointmentCsvRow[],
  options: {
    upcomingOnly: boolean;
    reconcileUpcoming?: boolean;
    keepBooklyIds?: number[];
  },
): Promise<BooklyAppointmentImportResult> {
  const result: BooklyAppointmentImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    cancelled: 0,
    clientsCreated: 0,
    unmatchedStaff: 0,
    missingService: 0,
    errors: [],
  };

  const catalog = await fetchBooklyAppointmentCatalog(supabase, tenantId);
  const servicesByBookly = new Map(
    catalog.services.filter((s) => s.bookly_id != null).map((s) => [s.bookly_id as number, s]),
  );
  const staffByBookly = new Map(
    catalog.staff.filter((s) => s.bookly_id != null).map((s) => [s.bookly_id as number, s]),
  );
  const staffByName = new Map(
    catalog.staff.map((s) => [normalizeName(s.full_name) ?? "", s]),
  );
  const existingByBookly = new Map(
    catalog.existingAppointments.map((a) => [a.bookly_id, a.id]),
  );

  const filtered = filterUpcomingRows(rows, options.upcomingOnly);
  const seen = new Set<number>();
  const staffBooklyToPersist = new Map<string, number>();

  for (const row of filtered) {
    if (seen.has(row.booklyCaId) || row.status === "skip") {
      result.skipped += 1;
      continue;
    }
    seen.add(row.booklyCaId);

    const service = servicesByBookly.get(row.serviceBooklyId);
    if (!service) {
      result.missingService += 1;
      result.errors.push(
        `L${row.lineNumber}: prestation Bookly #${row.serviceBooklyId} (${row.serviceTitle || "?"}) introuvable — importez d’abord bookly-services.csv`,
      );
      continue;
    }

    const startsAt = new Date(row.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      result.skipped += 1;
      result.errors.push(`L${row.lineNumber}: date invalide (${row.startsAt})`);
      continue;
    }
    let endsAt = row.endsAt ? new Date(row.endsAt) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    }

    const staff = resolveStaffId(row, staffByBookly, staffByName);
    if (staff.unmatched) result.unmatchedStaff += 1;
    if (staff.id && row.staffBooklyId != null && !staffByBookly.has(row.staffBooklyId)) {
      staffBooklyToPersist.set(staff.id, row.staffBooklyId);
      staffByBookly.set(row.staffBooklyId, {
        id: staff.id,
        full_name: row.staffName,
        bookly_id: row.staffBooklyId,
      });
    }

    let clientId: string | null = null;
    const names = splitCustomerName(row);
    if (row.customerBooklyId || row.customerEmail || row.customerPhone || names.firstName || names.lastName) {
      try {
        const matched = await findOrCreateClientFromExternal(supabase, {
          tenantId,
          source: "bookly",
          externalId: row.customerBooklyId ? String(row.customerBooklyId) : null,
          email: row.customerEmail,
          phone: row.customerPhone,
          firstName: names.firstName,
          lastName: names.lastName,
          extraTags: ["Bookly"],
          metadata: { bookly_customer_id: row.customerBooklyId },
        });
        clientId = matched.clientId;
        if (matched.matched === "created") result.clientsCreated += 1;
      } catch (err) {
        result.errors.push(
          `L${row.lineNumber}: client ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const extras = resolveExtras(row, service.id, catalog.extras);
    const payload = {
      tenant_id: tenantId,
      client_id: clientId,
      service_id: service.id,
      staff_id: staff.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: row.status,
      price_cents: row.priceCents,
      notes: row.notes,
      bookly_id: row.booklyCaId,
    };

    const existingId = existingByBookly.get(row.booklyCaId);
    try {
      if (existingId) {
        const { error } = await supabase.from("inst_appointments").update(payload).eq("id", existingId);
        if (error) {
          result.errors.push(`L${row.lineNumber}: ${error.message}`);
          continue;
        }
        const extraErr = await syncAppointmentExtras(
          supabase,
          tenantId,
          existingId,
          service.id,
          extras,
        );
        if (extraErr) result.errors.push(`L${row.lineNumber} extras: ${extraErr}`);
        result.updated += 1;
      } else {
        const { data, error } = await supabase
          .from("inst_appointments")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) {
          result.errors.push(`L${row.lineNumber}: ${error?.message ?? "insert_failed"}`);
          continue;
        }
        existingByBookly.set(row.booklyCaId, data.id);
        const extraErr = await syncAppointmentExtras(
          supabase,
          tenantId,
          data.id,
          service.id,
          extras,
        );
        if (extraErr) result.errors.push(`L${row.lineNumber} extras: ${extraErr}`);
        result.created += 1;
      }
    } catch (err) {
      result.errors.push(`L${row.lineNumber}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const [staffId, booklyId] of staffBooklyToPersist) {
    await supabase.from("inst_staff").update({ bookly_id: booklyId }).eq("id", staffId);
  }

  if (options.reconcileUpcoming) {
    const keep = new Set(
      (options.keepBooklyIds?.length ? options.keepBooklyIds : [...seen]).filter((id) => id > 0),
    );
    const cutoff = startOfToday().toISOString();
    const { data: existingUpcoming, error: existingErr } = await supabase
      .from("inst_appointments")
      .select("id, bookly_id, status")
      .eq("tenant_id", tenantId)
      .not("bookly_id", "is", null)
      .gte("starts_at", cutoff)
      .neq("status", "cancelled");
    if (existingErr) {
      result.errors.push(`reconcile: ${existingErr.message}`);
    } else {
      const toCancel = (existingUpcoming ?? []).filter(
        (a) => typeof a.bookly_id === "number" && !keep.has(a.bookly_id),
      );
      for (const appt of toCancel) {
        const { error } = await supabase
          .from("inst_appointments")
          .update({ status: "cancelled" })
          .eq("id", appt.id);
        if (error) {
          result.errors.push(`cancel #${appt.bookly_id}: ${error.message}`);
          continue;
        }
        result.cancelled += 1;
      }
    }
  }

  return result;
}
