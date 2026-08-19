import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchBooklyAppointmentCatalog } from "@/lib/institut/appointment-import/bookly-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const catalog = await fetchBooklyAppointmentCatalog(supabase, session.tenant.id);
    return NextResponse.json(catalog);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[appointments-import-status]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load_failed" },
      { status: 500 },
    );
  }
}
