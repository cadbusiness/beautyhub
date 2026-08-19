import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchExistingExtrasCatalog,
  runBooklyExtrasImport,
  type BooklyExtraCsvRow,
} from "@/lib/institut/service-import/bookly-extras-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toRow(input: unknown): BooklyExtraCsvRow | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const toNum = (v: unknown, fallback = 0): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const toStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const booklyExtraId = toNum(r.booklyExtraId, 0);
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const serviceBooklyId = toNum(r.serviceBooklyId, 0);
  if (!booklyExtraId || !title || !serviceBooklyId) return null;

  return {
    booklyExtraId,
    title,
    serviceBooklyId,
    serviceTitle: typeof r.serviceTitle === "string" ? r.serviceTitle : "",
    durationMin: Math.max(0, toNum(r.durationMin, 0)),
    priceCents: Math.max(0, toNum(r.priceCents, 0)),
    minQuantity: Math.max(0, toNum(r.minQuantity, 0)),
    maxQuantity: Math.max(1, toNum(r.maxQuantity, 1)),
    sortOrder: toNum(r.sortOrder, 0),
    imageUrl: toStr(r.imageUrl),
    lineNumber: toNum(r.lineNumber, 0),
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const existing = await fetchExistingExtrasCatalog(supabase, session.tenant.id);
    return NextResponse.json(existing);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[services-import-extras-status]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load_failed" },
      { status: 500 },
    );
  }
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
    if (body.rows.length > 3000) {
      return NextResponse.json({ error: "batch_too_large" }, { status: 400 });
    }

    const rows: BooklyExtraCsvRow[] = [];
    for (const raw of body.rows) {
      const row = toRow(raw);
      if (row) rows.push(row);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "no_valid_rows" }, { status: 400 });
    }

    const result = await runBooklyExtrasImport(supabase, session.tenant.id, rows);
    return NextResponse.json(result);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[services-import-extras]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "import_failed" },
      { status: 500 },
    );
  }
}
