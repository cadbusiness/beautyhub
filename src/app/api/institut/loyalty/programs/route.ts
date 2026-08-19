import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const session = await requireInstitutApi(request);
  const supabase = await createClient();
  const { data } = await supabase
    .from("inst_loyalty_programs")
    .select("id, name, is_active, points_label")
    .eq("tenant_id", session.tenant.id)
    .order("created_at");
  return Response.json({ programs: data ?? [] });
}
