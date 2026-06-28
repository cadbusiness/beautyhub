import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { BookingExtraLine } from "@/lib/institut/service-extras";

type Db = SupabaseClient<Database>;

export async function resolveStaff(
  supabase: Db,
  tenantId: string,
  input: { staff_id?: string; staff_name?: string },
) {
  if (input.staff_id) {
    const { data } = await supabase
      .from("inst_staff")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("id", input.staff_id)
      .maybeSingle();
    return data;
  }
  const name = input.staff_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("inst_staff")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .ilike("full_name", `%${name}%`)
    .limit(2);
  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      `Plusieurs membres correspondent à « ${name} » : ${data.map((s) => s.full_name).join(", ")}. Précisez le nom.`,
    );
  }
  return data[0];
}

export async function resolveResource(
  supabase: Db,
  tenantId: string,
  input: { resource_id?: string; resource_name?: string },
) {
  if (input.resource_id) {
    const { data } = await supabase
      .from("inst_resources")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("id", input.resource_id)
      .maybeSingle();
    return data;
  }
  const name = input.resource_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("inst_resources")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .ilike("name", `%${name}%`)
    .limit(2);
  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      `Plusieurs cabines correspondent à « ${name} » : ${data.map((r) => r.name).join(", ")}.`,
    );
  }
  return data[0];
}

export async function resolveSchedule(
  supabase: Db,
  tenantId: string,
  input: { schedule_id?: string; schedule_name?: string },
) {
  if (input.schedule_id) {
    const { data } = await supabase
      .from("inst_schedules")
      .select("id, name, is_default")
      .eq("tenant_id", tenantId)
      .eq("id", input.schedule_id)
      .maybeSingle();
    return data;
  }
  const name = input.schedule_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("inst_schedules")
    .select("id, name, is_default")
    .eq("tenant_id", tenantId)
    .ilike("name", `%${name}%`)
    .limit(2);
  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      `Plusieurs grilles correspondent à « ${name} » : ${data.map((s) => s.name).join(", ")}.`,
    );
  }
  return data[0];
}

export async function resolveService(
  supabase: Db,
  tenantId: string,
  input: { service_id?: string; service_name?: string },
) {
  if (input.service_id) {
    const { data } = await supabase
      .from("inst_services")
      .select("id, name, duration_min, price_cents")
      .eq("tenant_id", tenantId)
      .eq("id", input.service_id)
      .maybeSingle();
    return data;
  }
  const name = input.service_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("inst_services")
    .select("id, name, duration_min, price_cents")
    .eq("tenant_id", tenantId)
    .ilike("name", `%${name}%`)
    .limit(2);
  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      `Plusieurs prestations correspondent à « ${name} » : ${data.map((s) => s.name).join(", ")}.`,
    );
  }
  return data[0];
}

export async function resolveClient(
  supabase: Db,
  tenantId: string,
  input: { client_id?: string; client_email?: string; client_name?: string },
) {
  if (input.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("id, email, full_name")
      .eq("tenant_id", tenantId)
      .eq("id", input.client_id)
      .maybeSingle();
    return data;
  }
  const email = input.client_email?.trim().toLowerCase();
  if (email) {
    const { data } = await supabase
      .from("clients")
      .select("id, email, full_name")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .maybeSingle();
    return data;
  }
  const name = input.client_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, email, full_name")
    .eq("tenant_id", tenantId)
    .ilike("full_name", `%${name}%`)
    .limit(2);
  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      `Plusieurs clients correspondent à « ${name} » : ${data.map((c) => c.full_name ?? c.email).join(", ")}.`,
    );
  }
  return data[0];
}

export async function resolveAppointmentExtras(
  supabase: Db,
  tenantId: string,
  parentServiceId: string,
  input: {
    extras?: Array<{
      service_id?: string;
      extra_name?: string;
      quantity: number;
    }>;
  },
): Promise<BookingExtraLine[]> {
  const lines: BookingExtraLine[] = [];
  if (!input.extras?.length) return lines;

  for (const row of input.extras) {
    const qty = Math.max(1, Math.floor(row.quantity));
    if (row.service_id) {
      const { data: link } = await supabase
        .from("inst_service_extras")
        .select("extra_service_id")
        .eq("tenant_id", tenantId)
        .eq("service_id", parentServiceId)
        .eq("extra_service_id", row.service_id)
        .maybeSingle();
      if (!link) {
        throw new Error(`Extra non autorise pour cette prestation : ${row.service_id}`);
      }
      lines.push({ service_id: row.service_id, quantity: qty });
      continue;
    }
    const name = row.extra_name?.trim();
    if (!name) continue;
    const { data: candidates } = await supabase
      .from("inst_service_extras")
      .select("extra_service_id, extra:inst_services!inst_service_extras_extra_service_id_fkey(name)")
      .eq("tenant_id", tenantId)
      .eq("service_id", parentServiceId);
    const matches = (candidates ?? []).filter((c) => {
      const extra = Array.isArray(c.extra) ? c.extra[0] : c.extra;
      return extra?.name.toLowerCase().includes(name.toLowerCase());
    });
    if (matches.length === 0) {
      throw new Error(`Extra introuvable : ${name}`);
    }
    if (matches.length > 1) {
      const names = matches.map((m) => {
        const extra = Array.isArray(m.extra) ? m.extra[0] : m.extra;
        return extra?.name ?? "";
      });
      throw new Error(`Plusieurs extras correspondent à « ${name} » : ${names.join(", ")}`);
    }
    lines.push({ service_id: matches[0]!.extra_service_id, quantity: qty });
  }
  return lines;
}

export async function fetchTenantContext(supabase: Db, tenantId: string) {
  const [staff, resources, schedules, services] = await Promise.all([
    supabase
      .from("inst_staff")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("inst_resources")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inst_schedules")
      .select("id, name, is_default")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("inst_services")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    staff: staff.data ?? [],
    resources: resources.data ?? [],
    schedules: schedules.data ?? [],
    services: services.data ?? [],
  };
}
