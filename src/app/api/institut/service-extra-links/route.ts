import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadServiceExtraLinks } from "@/lib/institut/service-extras-load";

export async function GET(request: Request) {
  const serviceId = new URL(request.url).searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId required" }, { status: 400 });
  }

  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const links = await loadServiceExtraLinks(supabase, session.tenant.id, serviceId);
    return NextResponse.json(links);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[service-extra-links]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
