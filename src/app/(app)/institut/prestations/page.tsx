import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "./services-manager";

export default async function PrestationsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const [servicesRes, categoriesRes] = await Promise.all([
    supabase
      .from("inst_services")
      .select(
        "id, name, description, duration_min, price_cents, currency, color, is_active, visibility, image_url, extras_step_position, buffer_before_min, buffer_after_min, min_advance_hours, max_advance_days, booking_mode, category_id, sort_order, bookly_id",
      )
      .eq("tenant_id", session.tenant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("inst_service_categories")
      .select("id, name, sort_order, bookly_id")
      .eq("tenant_id", session.tenant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (servicesRes.error) {
    console.error("[prestations] services query", servicesRes.error.message);
  }
  if (categoriesRes.error) {
    console.error("[prestations] categories query", categoriesRes.error.message);
  }

  const categories = categoriesRes.data ?? [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const rows = (servicesRes.data ?? []).map((s) => ({
    ...s,
    category_name: s.category_id ? (categoryNameById.get(s.category_id) ?? null) : null,
  }));

  return <ServicesManager services={rows} categories={categories} />;
}
