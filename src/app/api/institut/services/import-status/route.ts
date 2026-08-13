import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchExistingBooklyCatalog } from "@/lib/institut/service-import/bookly-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const existing = await fetchExistingBooklyCatalog(supabase, session.tenant.id);
    return NextResponse.json({
      categories: existing.categories,
      services: existing.services,
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[services-import-status]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load_failed" },
      { status: 500 },
    );
  }
}
