import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  runBooklyAppointmentsImport,
  toRowFromObject,
  type BooklyAppointmentCsvRow,
} from "@/lib/institut/appointment-import/bookly-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    const supabase = await createClient();

    let body: { rows?: unknown; upcomingOnly?: boolean };
    try {
      body = (await request.json()) as { rows?: unknown; upcomingOnly?: boolean };
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "empty_batch" }, { status: 400 });
    }
    if (body.rows.length > 200) {
      return NextResponse.json({ error: "batch_too_large" }, { status: 400 });
    }

    const rows: BooklyAppointmentCsvRow[] = [];
    for (let i = 0; i < body.rows.length; i += 1) {
      const row = toRowFromObject(body.rows[i], i + 1);
      if (row) rows.push(row);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "no_valid_rows" }, { status: 400 });
    }

    const result = await runBooklyAppointmentsImport(supabase, session.tenant.id, rows, {
      upcomingOnly: body.upcomingOnly !== false,
    });
    return NextResponse.json(result);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[appointments-import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "import_failed" },
      { status: 500 },
    );
  }
}
