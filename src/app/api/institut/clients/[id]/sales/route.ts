import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchClientSales } from "@/lib/institut/clients";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireModule("institut");
    const supabase = await createClient();
    const payload = await fetchClientSales(supabase, session.tenant.id, id);
    return NextResponse.json(payload);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[client-sales]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
