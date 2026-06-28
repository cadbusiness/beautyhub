import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { ListPanel } from "@/components/ui/list-panel";
import { loadBookingFlowsAdmin } from "./actions";
import { BookingFlowsManager } from "./booking-flows-manager";

export default async function ReservationPubliquePage() {
  const session = await requireModule("institut");
  const t = await getTranslations("appointments.bookingPublic");
  const supabase = await createClient();
  const [{ flows, publicBaseUrl }, servicesRes] = await Promise.all([
    loadBookingFlowsAdmin(),
    supabase
      .from("inst_services")
      .select("id, name, duration_min, price_cents, visibility")
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  const services = (servicesRes.data ?? [])
    .filter((s) => s.visibility !== "extra_only")
    .map((s) => ({
      id: s.id,
      label: `${s.name} (${s.duration_min} min · ${formatPrice(s.price_cents)})`,
    }));

  return (
    <ListPanel>
      <div className="border-b border-slate-200 px-4 py-3 lg:px-6">
        <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      </div>
      <BookingFlowsManager flows={flows} services={services} publicBaseUrl={publicBaseUrl} />
    </ListPanel>
  );
}
