import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireModule("institut");
    const supabase = createServiceClient();

    const [{ count }, { data: sub }, { data: rows, error }] = await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id),
      supabase
        .from("subscriptions")
        .select("plans(limits)")
        .eq("tenant_id", session.tenant.id)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("metadata")
        .eq("tenant_id", session.tenant.id)
        .filter("metadata->>overcache_ref", "not.is", null),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const limits = (sub?.plans as { limits?: Record<string, unknown> } | null)?.limits;
    const quotaLimit =
      limits && typeof limits.clients === "number" ? limits.clients : null;

    const existingRefs = (rows ?? [])
      .map((row) => {
        const metadata =
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
        return typeof metadata.overcache_ref === "string" ? metadata.overcache_ref : null;
      })
      .filter((ref): ref is string => Boolean(ref));

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
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
