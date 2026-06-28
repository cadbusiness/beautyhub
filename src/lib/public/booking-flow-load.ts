import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseBookingFlowConfig,
  type BookingFlowConfig,
} from "@/lib/institut/booking-flows";

export interface PublicBookingFlow {
  id: string;
  name: string;
  slug: string;
  config: BookingFlowConfig;
}

export async function loadPublicBookingFlow(
  tenantId: string,
  slug?: string | null,
): Promise<PublicBookingFlow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_public_booking_flow", {
      p_tenant_id: tenantId,
      p_slug: slug ?? undefined,
    })
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    config: parseBookingFlowConfig(data.config),
  };
}

export async function requirePublicBookingFlow(
  tenantId: string,
  slug?: string | null,
): Promise<PublicBookingFlow> {
  const flow = await loadPublicBookingFlow(tenantId, slug);
  if (!flow) notFound();
  return flow;
}
