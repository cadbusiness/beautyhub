import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import { translateQuotaError } from "@/lib/i18n/quota";
import {
  fetchExistingRovercashClients,
  isGeneratedImportEmail,
  ROVERCASH_IMPORT_TAG,
  type RovercashImportRow,
} from "@/lib/institut/client-import/rovercash-csv";
import type { Database, Json } from "@/lib/db/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

type BatchBody = {
  rows: RovercashImportRow[];
  expectedCreate?: number;
};

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRow(input: unknown): RovercashImportRow | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const reference = sanitizeString(record.reference).trim();
  const fullName = sanitizeString(record.fullName).trim();
  const email = sanitizeString(record.email).trim();
  if (!reference || !fullName || !email) return null;

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10)
    : [ROVERCASH_IMPORT_TAG];

  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : {};

  const lineNumber =
    typeof record.lineNumber === "number" && Number.isFinite(record.lineNumber)
      ? record.lineNumber
      : 0;

  return {
    reference,
    fullName,
    email,
    phone: toNullableString(record.phone),
    tags,
    metadata,
    createdAt: toNullableString(record.createdAt),
    lineNumber,
  };
}

export async function POST(request: Request) {
  try {
    const session = await requireModule("institut");
    const supabase = await createClient();

    let body: BatchBody;
    try {
      body = (await request.json()) as BatchBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "empty_batch" }, { status: 400 });
    }

    if (body.rows.length > 500) {
      return NextResponse.json({ error: "batch_too_large" }, { status: 400 });
    }

    const normalized = body.rows
      .map(normalizeRow)
      .filter((row): row is RovercashImportRow => row !== null);

    if (normalized.length === 0) {
      return NextResponse.json({ error: "no_valid_rows" }, { status: 400 });
    }

    const existingByRef = await fetchExistingRovercashClients(supabase, session.tenant.id);

    const seenRefs = new Set<string>();
    const toInsert: Database["public"]["Tables"]["clients"]["Insert"][] = [];
    const toUpdate: Array<{
      id: string;
      patch: Database["public"]["Tables"]["clients"]["Update"];
    }> = [];

    for (const row of normalized) {
      if (seenRefs.has(row.reference)) continue;
      seenRefs.add(row.reference);

      const existing = existingByRef.get(row.reference);
      if (existing) {
        const mergedTags = [...new Set([...existing.tags, ...row.tags])].slice(0, 10);
        const keepEmail = !isGeneratedImportEmail(existing.email, session.tenant.slug)
          ? existing.email
          : row.email;
        const phone = row.phone ?? existing.phone;

        toUpdate.push({
          id: existing.id,
          patch: {
            full_name: row.fullName,
            email: keepEmail,
            phone,
            tags: mergedTags,
            metadata: { ...existing.metadata, ...row.metadata } as Json,
            updated_at: new Date().toISOString(),
          },
        });
      } else {
        const insertRow: Database["public"]["Tables"]["clients"]["Insert"] = {
          tenant_id: session.tenant.id,
          full_name: row.fullName,
          email: row.email,
          phone: row.phone,
          tags: row.tags,
          metadata: row.metadata as Json,
          marketing_opt_in: false,
        };
        if (row.createdAt) insertRow.created_at = row.createdAt;
        toInsert.push(insertRow);
      }
    }

    if (toInsert.length > 0) {
      try {
        await assertQuota(session.tenant.id, "clients", toInsert.length);
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          const message = await translateQuotaError(error);
          return NextResponse.json({ error: message, kind: "quota" }, { status: 409 });
        }
        throw error;
      }
    }

    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    if (toInsert.length > 0) {
      const { error } = await supabase.from("clients").insert(toInsert);
      if (error) {
        errors.push(error.message);
      } else {
        created = toInsert.length;
      }
    }

    for (const { id, patch } of toUpdate) {
      const { error } = await supabase
        .from("clients")
        .update(patch)
        .eq("tenant_id", session.tenant.id)
        .eq("id", id);
      if (error) {
        errors.push(error.message);
      } else {
        updated += 1;
      }
    }

    return NextResponse.json({
      created,
      updated,
      errors,
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[institut-clients-import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "import_failed" },
      { status: 500 },
    );
  }
}
