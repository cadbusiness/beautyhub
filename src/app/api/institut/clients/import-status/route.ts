import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { OVERCACHE_IMPORT_TAG } from "@/lib/institut/client-import/constants";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireModule("institut");
    const supabase = await createClient();

    const [{ count }, { data: sub }] = await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id),
      supabase
        .from("subscriptions")
        .select("plans(limits)")
        .eq("tenant_id", session.tenant.id)
        .maybeSingle(),
    ]);

    const existingRefs: string[] = [];
    let from = 0;
    const pageSize = 1000;
    while (from < 20_000) {
      const { data, error } = await supabase
        .from("clients")
        .select("metadata")
        .eq("tenant_id", session.tenant.id)
        .contains("tags", [OVERCACHE_IMPORT_TAG])
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const metadata =
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
        if (typeof metadata.overcache_ref === "string") {
          existingRefs.push(metadata.overcache_ref);
        }
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const limits = (sub?.plans as { limits?: Record<string, unknown> } | null)?.limits;
    const quotaLimit =
      limits && typeof limits.clients === "number" ? limits.clients : null;

    return NextResponse.json({
      quotaLimit,
      quotaUsage: count ?? 0,
      existingRefs,
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[institut-clients-import-status]", error);
    return NextResponse.json(
      {
        quotaLimit: null,
        quotaUsage: 0,
        existingRefs: [],
        error: error instanceof Error ? error.message : "load_failed",
      },
      { status: 200 },
    );
  }
}
