import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { requirePublicBookingFlow } from "@/lib/public/booking-flow-load";
import { BookingPublicView } from "../booking-public-view";

export default async function ReserverSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const tenant = await getPublicSiteTenant();
  if (!tenant) return null;

  const { slug } = await params;
  const { service: initialServiceId } = await searchParams;
  const flow = await requirePublicBookingFlow(tenant.id, slug);

  return (
    <BookingPublicView flow={flow} initialServiceId={initialServiceId ?? ""} />
  );
}
