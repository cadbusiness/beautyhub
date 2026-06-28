import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchDashboardSnapshot,
  parseDashboardPeriod,
} from "@/lib/institut/dashboard-stats";
import { getLocale } from "next-intl/server";

export async function GET(request: Request) {
  const period = parseDashboardPeriod(new URL(request.url).searchParams.get("period"));

  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const locale = await getLocale();
    const snapshot = await fetchDashboardSnapshot(
      supabase,
      session.tenant.id,
      period,
      locale,
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[dashboard-stats]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
