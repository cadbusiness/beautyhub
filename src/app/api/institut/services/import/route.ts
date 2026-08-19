import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  runBooklyServicesImport,
  type BooklyServiceCsvRow,
} from "@/lib/institut/service-import/bookly-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toRow(input: unknown): BooklyServiceCsvRow | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const booklyId = typeof r.booklyId === "number" ? r.booklyId : Number(r.booklyId);
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!Number.isFinite(booklyId) || booklyId <= 0 || !title) return null;

  const toStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const toNum = (v: unknown, fallback = 0): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    booklyId,
    title,
    categoryId:
      typeof r.categoryId === "number" && Number.isFinite(r.categoryId) ? r.categoryId : null,
    categoryName: typeof r.categoryName === "string" ? r.categoryName : "",
    durationMin: Math.max(1, toNum(r.durationMin, 30)),
    priceCents: Math.max(0, toNum(r.priceCents, 0)),
    color: toStr(r.color),
    visibility: r.visibility === "extra_only" ? "extra_only" : "catalog",
    isActive: r.isActive !== false,
    bufferBeforeMin: Math.max(0, toNum(r.bufferBeforeMin, 0)),
    bufferAfterMin: Math.max(0, toNum(r.bufferAfterMin, 0)),
    description: toStr(r.description),
    sortOrder: toNum(r.sortOrder, 0),
    lineNumber: toNum(r.lineNumber, 0),
  };
}

export async function POST(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    const supabase = await createClient();

    let body: { rows?: unknown };
    try {
      body = (await request.json()) as { rows?: unknown };
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "empty_batch" }, { status: 400 });
    }
    if (body.rows.length > 2000) {
      return NextResponse.json({ error: "batch_too_large" }, { status: 400 });
    }

    const rows: BooklyServiceCsvRow[] = [];
    for (const raw of body.rows) {
      const row = toRow(raw);
      if (row) rows.push(row);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "no_valid_rows" }, { status: 400 });
    }

    const result = await runBooklyServicesImport(supabase, session.tenant.id, rows);
    return NextResponse.json(result);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[services-import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "import_failed" },
      { status: 500 },
    );
  }
}
