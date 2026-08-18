import { NextResponse } from "next/server";
import {
  importBooklyWebhookPayload,
  resolveBooklyWebhookTenant,
} from "@/lib/institut/appointment-import/bookly-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SyncBody = {
  mode?: "upsert" | "full";
  rows?: unknown;
  keep_ids?: unknown;
  keepBooklyIds?: unknown;
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

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const keepBooklyIds = asIdList(body.keep_ids ?? body.keepBooklyIds);
  const mode = body.mode === "full" ? "full" : "upsert";

  if (rows.length > 400) {
    return NextResponse.json({ error: "batch_too_large" }, { status: 400 });
  }

  try {
    const result = await importBooklyWebhookPayload({
      token,
      rows,
      keepIds: keepBooklyIds,
      mode,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    console.error("[bookly-webhook]", error);
    const status = message.includes("invalid_token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
