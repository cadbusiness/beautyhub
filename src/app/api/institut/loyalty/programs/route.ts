import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data } = await supabase
    .from("inst_loyalty_programs")
    .select("id, name, is_active, points_label")
    .eq("tenant_id", session.tenant.id)
    .order("created_at");
  return Response.json({ programs: data ?? [] });
}
