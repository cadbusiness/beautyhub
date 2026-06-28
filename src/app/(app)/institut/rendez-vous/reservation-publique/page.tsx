import { Suspense } from "react";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { ListPanel } from "@/components/ui/list-panel";
import { loadBookingFlowsAdmin } from "./actions";
import { BookingFlowsManager } from "./booking-flows-manager";
import { RdvTabLinks } from "../rdv-tab-links";

function TabLinksFallback() {
  return <div className="h-[45px] border-b border-slate-200" aria-hidden />;
}

export default async function ReservationPubliquePage() {
  const session = await requireModule("institut");
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
      <Suspense fallback={<TabLinksFallback />}>
        <RdvTabLinks />
      </Suspense>
      <BookingFlowsManager flows={flows} services={services} publicBaseUrl={publicBaseUrl} />
    </ListPanel>
  );
}
