import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  markBooklySyncResult,
  resolveBooklyWebhookTenant,
} from "@/lib/institut/appointment-import/bookly-sync";
import {
  runBooklyAppointmentsImport,
  toRowFromObject,
  type BooklyAppointmentCsvRow,
} from "@/lib/institut/appointment-import/bookly-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SyncBody = {
  mode?: "upsert" | "full";
  rows?: unknown;
  keep_ids?: unknown;
  keepBooklyIds?: unknown;
  cancelled_ids?: unknown;
  cancelledBooklyIds?: unknown;
};

function asIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const conn = await resolveBooklyWebhookTenant(token);
  if (!conn) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rows: BooklyAppointmentCsvRow[] = [];
  if (Array.isArray(body.rows)) {
    for (let i = 0; i < body.rows.length; i += 1) {
      const row = toRowFromObject(body.rows[i], i + 1);
      if (row) rows.push(row);
    }
  }

  const cancelledIds = asIdList(body.cancelled_ids ?? body.cancelledBooklyIds);
  const keepBooklyIds = asIdList(body.keep_ids ?? body.keepBooklyIds);
  const mode = body.mode === "full" ? "full" : "upsert";

  if (rows.length === 0 && cancelledIds.length === 0 && mode !== "full") {
    await markBooklySyncResult(conn.connectionId, null);
    return NextResponse.json({ ok: true, created: 0, updated: 0, cancelled: 0 });
  }
  if (rows.length > 400) {
    return NextResponse.json({ error: "batch_too_large" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    let resultOffset = 0;

    if (cancelledIds.length) {
      const { data: existing } = await supabase
        .from("inst_appointments")
        .select("id, bookly_id")
        .eq("tenant_id", conn.tenantId)
        .in("bookly_id", cancelledIds);
      for (const appt of existing ?? []) {
        await supabase.from("inst_appointments").update({ status: "cancelled" }).eq("id", appt.id);
      }
      resultOffset = existing?.length ?? 0;
    }

    const result = await runBooklyAppointmentsImport(supabase, conn.tenantId, rows, {
      upcomingOnly: false,
      reconcileUpcoming: mode === "full" && (rows.length > 0 || keepBooklyIds.length > 0),
      keepBooklyIds:
        mode === "full"
          ? keepBooklyIds.length
            ? keepBooklyIds
            : rows.map((r) => r.booklyCaId)
          : undefined,
    });
    result.cancelled += resultOffset;

    const errorSummary = result.errors.length ? result.errors.slice(0, 5).join(" | ") : null;
    await markBooklySyncResult(conn.connectionId, errorSummary);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    await markBooklySyncResult(conn.connectionId, message);
    console.error("[bookly-webhook]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
