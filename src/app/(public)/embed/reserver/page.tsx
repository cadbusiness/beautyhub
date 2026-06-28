import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { loadPublicBookingFlow } from "@/lib/public/booking-flow-load";
import { BookingPublicView } from "@/app/(public)/reserver/booking-public-view";

export default async function EmbedReserverPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const tenant = await getPublicSiteTenant();
  if (!tenant) return null;

  const { service: initialServiceId } = await searchParams;
  const flow = await loadPublicBookingFlow(tenant.id, null);
  if (!flow) return null;

  return (
    <BookingPublicView flow={flow} initialServiceId={initialServiceId ?? ""} embed />
  );
}
