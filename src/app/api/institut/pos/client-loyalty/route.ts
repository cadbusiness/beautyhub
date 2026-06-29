import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadPosClientLoyalty } from "@/lib/institut/pos-client-loyalty";

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("client_id")?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "client_id_required" }, { status: 400 });
  }

  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const snapshot = await loadPosClientLoyalty(supabase, session.tenant.id, clientId);
    return NextResponse.json(snapshot ?? { active: false, balance: 0, rewards: [] });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[pos/client-loyalty]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
