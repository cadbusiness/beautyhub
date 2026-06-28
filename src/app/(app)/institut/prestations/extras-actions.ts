"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ServiceExtraConfig } from "@/lib/institut/service-extras";
import {
  persistServiceExtras,
  type ServiceExtraLinkInput,
} from "@/lib/institut/service-extras-persist";

export type { ServiceExtraLinkInput };

export async function loadInstServiceExtras(serviceId: string): Promise<ServiceExtraConfig[]> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data } = await supabase
    .from("inst_service_extras")
    .select(
      "min_qty, max_qty, sort_order, extra:inst_services!inst_service_extras_extra_service_id_fkey(id, name, description, duration_min, price_cents, image_url, is_active)",
    )
    .eq("tenant_id", session.tenant.id)
    .eq("service_id", serviceId)
    .order("sort_order");

  return (data ?? [])
    .filter((row) => {
      const extra = Array.isArray(row.extra) ? row.extra[0] : row.extra;
      return extra?.is_active;
    })
    .map((row) => {
      const extra = Array.isArray(row.extra) ? row.extra[0]! : row.extra!;
      return {
        extra_service_id: extra.id,
        name: extra.name,
        description: extra.description,
        duration_min: extra.duration_min,
        price_cents: extra.price_cents,
        image_url: extra.image_url,
        min_qty: row.min_qty,
        max_qty: row.max_qty,
        sort_order: row.sort_order,
      };
    });
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
