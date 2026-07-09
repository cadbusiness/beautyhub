"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ServiceExtraConfig } from "@/lib/institut/service-extras";
import {
  persistServiceExtras,
  type ServiceExtraLinkInput,
} from "@/lib/institut/service-extras-persist";
import { loadServiceExtrasCatalog, loadServiceExtraLinks as loadServiceExtraLinksQuery } from "@/lib/institut/service-extras-load";

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
  return loadServiceExtraLinksQuery(supabase, session.tenant.id, serviceId);
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
  if (err) {
    if (err === "invalid_extra_selection") {
      const t = await getTranslations("institut.actions");
      return { error: t("extrasInvalid") };
    }
    return { error: err };
  }

  revalidatePath("/institut/prestations");
  revalidatePath("/reserver");
  return { ok: true };
}
