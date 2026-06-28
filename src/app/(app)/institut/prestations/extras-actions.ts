"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ServiceExtraConfig } from "@/lib/institut/service-extras";
import {
  persistServiceExtras,
  type ServiceExtraLinkInput,
} from "@/lib/institut/service-extras-persist";
import { loadServiceExtrasCatalog } from "@/lib/institut/service-extras-load";

export type { ServiceExtraLinkInput };

export async function loadInstServiceExtras(serviceId: string): Promise<ServiceExtraConfig[]> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  return loadServiceExtrasCatalog(supabase, session.tenant.id, serviceId);
}

export async function loadServiceExtraLinks(
  serviceId: string,
): Promise<ServiceExtraLinkInput[]> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data } = await supabase
    .from("inst_service_extras")
    .select("extra_service_id, min_qty, max_qty, sort_order")
    .eq("tenant_id", session.tenant.id)
    .eq("service_id", serviceId)
    .order("sort_order");
  return data ?? [];
}

export async function saveServiceExtras(
  serviceId: string,
  links: ServiceExtraLinkInput[],
  extrasStepPosition: "before_time" | "after_time",
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const err = await persistServiceExtras(
    supabase,
    session.tenant.id,
    serviceId,
    links,
    extrasStepPosition,
  );
  if (err) return { error: err };

  revalidatePath("/institut/prestations");
  revalidatePath("/reserver");
  return { ok: true };
}
