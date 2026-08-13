import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "./services-manager";
import type { ServiceRow } from "./service-dialog";
import type { ServiceCategoryRow } from "../actions";

async function loadPrestationsData(): Promise<{
  services: ServiceRow[];
  categories: ServiceCategoryRow[];
}> {
  try {
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
      console.error("[prestations] services query error:", servicesRes.error);
    }
    if (categoriesRes.error) {
      console.error("[prestations] categories query error:", categoriesRes.error);
    }

    const categories = (categoriesRes.data ?? []) as ServiceCategoryRow[];
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const services = ((servicesRes.data ?? []) as Array<Record<string, unknown>>).map(
      (s) => ({
        ...(s as unknown as ServiceRow),
        category_name: s.category_id
          ? (categoryNameById.get(String(s.category_id)) ?? null)
          : null,
      }),
    );

    return { services, categories };
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[prestations] SSR load failed:", error);
    return { services: [], categories: [] };
  }
}

export default async function PrestationsPage() {
  const { services, categories } = await loadPrestationsData();
  return <ServicesManager services={services} categories={categories} />;
}
