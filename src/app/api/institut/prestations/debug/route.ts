import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 20).join("\n"),
      digest:
        "digest" in error ? String((error as { digest?: string }).digest ?? "") : undefined,
    };
  }
  return { raw: String(error) };
}

export async function GET(request: Request) {
  const steps: Array<{ step: string; ok: boolean; info?: unknown; error?: unknown }> = [];

  try {
    steps.push({ step: "start", ok: true });

    let session;
    try {
      session = await requireInstitutApi(request);
      steps.push({
        step: "requireModule",
        ok: true,
        info: {
          tenant_id: session.tenant.id,
          tenant_slug: session.tenant.slug,
          role: session.role,
          modules: session.enabledModuleIds,
        },
      });
    } catch (e) {
      steps.push({ step: "requireModule", ok: false, error: safeError(e) });
      return NextResponse.json({ steps }, { status: 200 });
    }

    let supabase;
    try {
      supabase = await createClient();
      steps.push({ step: "createClient", ok: true });
    } catch (e) {
      steps.push({ step: "createClient", ok: false, error: safeError(e) });
      return NextResponse.json({ steps }, { status: 200 });
    }

    try {
      const svc = await supabase
        .from("inst_services")
        .select(
          "id, name, description, duration_min, price_cents, currency, color, is_active, visibility, image_url, extras_step_position, buffer_before_min, buffer_after_min, min_advance_hours, max_advance_days, booking_mode, category_id, sort_order, bookly_id",
        )
        .eq("tenant_id", session.tenant.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      steps.push({
        step: "services_query",
        ok: !svc.error,
        info: {
          rows: svc.data?.length ?? 0,
          error: svc.error ? { code: svc.error.code, message: svc.error.message } : null,
          sampleRow: svc.data?.[0] ?? null,
        },
      });
    } catch (e) {
      steps.push({ step: "services_query", ok: false, error: safeError(e) });
    }

    try {
      const cat = await supabase
        .from("inst_service_categories")
        .select("id, name, sort_order, bookly_id")
        .eq("tenant_id", session.tenant.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      steps.push({
        step: "categories_query",
        ok: !cat.error,
        info: {
          rows: cat.data?.length ?? 0,
          error: cat.error ? { code: cat.error.code, message: cat.error.message } : null,
          sampleRow: cat.data?.[0] ?? null,
        },
      });
    } catch (e) {
      steps.push({ step: "categories_query", ok: false, error: safeError(e) });
    }

    return NextResponse.json({ steps });
  } catch (error) {
    steps.push({ step: "outer_catch", ok: false, error: safeError(error) });
    return NextResponse.json({ steps }, { status: 200 });
  }
}
