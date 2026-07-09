import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type ClientRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  marketing_opt_in: boolean;
  has_portal_account: boolean;
  login_id: string | null;
  pin_code: string | null;
  referred_by_client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientListSummary = ClientRow & {
  appointment_count: number;
  upcoming_count: number;
  total_spent_cents: number;
  has_ecommerce: boolean;
  loyalty_points: number;
};

export type ClientAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number | null;
  notes: string | null;
  service_name: string | null;
  staff_name: string | null;
};

export type ClientSale = {
  id: string;
  ticket_number: string | null;
  total_cents: number;
  status: string;
  payment_method: string;
  woo_order_id: number | null;
  created_at: string;
  items: Array<{ name: string; quantity: number; unit_price_cents: number }>;
};

export type ClientTopService = {
  service_id: string;
  service_name: string;
  count: number;
};

export type ClientEnrollment = {
  id: string;
  course_title: string;
  status: string;
  enrolled_at: string;
};

export type ClientOverview = {
  client: ClientRow;
  stats: {
    appointment_count: number;
    completed_count: number;
    cancelled_count: number;
    no_show_count: number;
    upcoming_count: number;
    booking_rate: number | null;
    total_spent_cents: number;
    pos_spent_cents: number;
    ecommerce_spent_cents: number;
    sale_count: number;
    ecommerce_order_count: number;
    loyalty_points: number;
  };
  top_services: ClientTopService[];
  enrollments: ClientEnrollment[];
};

export type ClientAppointmentsPayload = {
  upcoming: ClientAppointment[];
  past: ClientAppointment[];
};

export type ClientSalesPayload = {
  sales: ClientSale[];
};

/** @deprecated Use fetchClientOverview + tab API routes */
export type ClientProfile = ClientOverview & {
  upcoming_appointments: ClientAppointment[];
  past_appointments: ClientAppointment[];
  sales: ClientSale[];
};

const CLIENT_SELECT =
  "id, full_name, email, phone, date_of_birth, address_line1, address_line2, city, postal_code, country, notes, tags, marketing_opt_in, login_id, pin_code, pin_hash, password_hash, referred_by_client_id, created_at, updated_at";

function mapClient(row: Record<string, unknown>): ClientRow {
  return {
    id: String(row.id),
    full_name: (row.full_name as string | null) ?? null,
    email: String(row.email),
    phone: (row.phone as string | null) ?? null,
    date_of_birth: (row.date_of_birth as string | null) ?? null,
    address_line1: (row.address_line1 as string | null) ?? null,
    address_line2: (row.address_line2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    postal_code: (row.postal_code as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    marketing_opt_in: Boolean(row.marketing_opt_in),
    has_portal_account: Boolean(row.pin_hash ?? row.password_hash),
    login_id: (row.login_id as string | null) ?? null,
    pin_code: (row.pin_code as string | null) ?? null,
    referred_by_client_id: (row.referred_by_client_id as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function fetchClientsWithSummary(
  supabase: Db,
  tenantId: string,
): Promise<ClientListSummary[]> {
  const now = new Date().toISOString();

  const [clientsRes, apptsRes, salesRes, loyaltyRes] = await Promise.all([
    supabase
      .from("clients")
      .select(CLIENT_SELECT)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inst_appointments")
      .select("client_id, status, starts_at")
      .eq("tenant_id", tenantId)
      .not("client_id", "is", null),
    supabase
      .from("inst_sales")
      .select("client_id, total_cents, status, woo_order_id")
      .eq("tenant_id", tenantId)
      .not("client_id", "is", null)
      .in("status", ["completed", "paid"]),
    supabase
      .from("inst_loyalty_balances")
      .select("client_id, points_balance")
      .eq("tenant_id", tenantId),
  ]);

  const apptStats = new Map<
    string,
    { total: number; upcoming: number }
  >();
  for (const a of apptsRes.data ?? []) {
    if (!a.client_id) continue;
    const cur = apptStats.get(a.client_id) ?? { total: 0, upcoming: 0 };
    cur.total += 1;
    if (
      a.starts_at >= now &&
      a.status !== "cancelled" &&
      a.status !== "no_show"
    ) {
      cur.upcoming += 1;
    }
    apptStats.set(a.client_id, cur);
  }

  const saleStats = new Map<
    string,
    { total: number; ecommerce: boolean }
  >();
  for (const s of salesRes.data ?? []) {
    if (!s.client_id) continue;
    const cur = saleStats.get(s.client_id) ?? { total: 0, ecommerce: false };
    cur.total += s.total_cents ?? 0;
    if (s.woo_order_id) cur.ecommerce = true;
    saleStats.set(s.client_id, cur);
  }

  const loyaltyMap = new Map<string, number>();
  for (const l of loyaltyRes.data ?? []) {
    loyaltyMap.set(
      l.client_id,
      (loyaltyMap.get(l.client_id) ?? 0) + (l.points_balance ?? 0),
    );
  }

  return (clientsRes.data ?? []).map((row) => {
    const client = mapClient(row as Record<string, unknown>);
    const appt = apptStats.get(client.id);
    const sale = saleStats.get(client.id);
    return {
      ...client,
      appointment_count: appt?.total ?? 0,
      upcoming_count: appt?.upcoming ?? 0,
      total_spent_cents: sale?.total ?? 0,
      has_ecommerce: sale?.ecommerce ?? false,
      loyalty_points: loyaltyMap.get(client.id) ?? 0,
    };
  });
}

export async function fetchClientOverview(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientOverview | null> {
  const now = new Date().toISOString();

  const { data: clientRow } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  if (!clientRow) return null;

  const [apptsRes, salesRes, loyaltyRes, enrollRes] = await Promise.all([
    supabase
      .from("inst_appointments")
      .select("status, starts_at, service_id")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId),
    supabase
      .from("inst_sales")
      .select("total_cents, status, woo_order_id")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId),
    supabase
      .from("inst_loyalty_balances")
      .select("points_balance")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId),
    supabase
      .from("acad_enrollments")
      .select("id, status, created_at, course_id")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let upcoming = 0;
  const serviceCounts = new Map<string, number>();

  for (const a of apptsRes.data ?? []) {
    if (a.status === "completed") completed += 1;
    else if (a.status === "cancelled") cancelled += 1;
    else if (a.status === "no_show") noShow += 1;

    if (
      a.starts_at >= now &&
      a.status !== "cancelled" &&
      a.status !== "no_show"
    ) {
      upcoming += 1;
    }

    if (a.service_id) {
      serviceCounts.set(a.service_id, (serviceCounts.get(a.service_id) ?? 0) + 1);
    }
  }

  const decided = completed + cancelled + noShow;
  const bookingRate = decided > 0 ? Math.round((completed / decided) * 100) : null;

  let totalSpent = 0;
  let posSpent = 0;
  let ecommerceSpent = 0;
  let ecommerceOrders = 0;
  let saleCount = 0;

  for (const s of salesRes.data ?? []) {
    if (s.status !== "completed" && s.status !== "paid") continue;
    saleCount += 1;
    totalSpent += s.total_cents ?? 0;
    if (s.woo_order_id) {
      ecommerceSpent += s.total_cents ?? 0;
      ecommerceOrders += 1;
    } else {
      posSpent += s.total_cents ?? 0;
    }
  }

  const topServiceIds = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const courseIds = [
    ...new Set(
      (enrollRes.data ?? [])
        .map((e) => e.course_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [servicesRes, coursesRes] = await Promise.all([
    topServiceIds.length
      ? supabase.from("inst_services").select("id, name").in("id", topServiceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    courseIds.length
      ? supabase.from("acad_courses").select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);

  const serviceNames = new Map(
    (servicesRes.data ?? []).map((s) => [s.id, s.name]),
  );
  const courseTitles = new Map(
    (coursesRes.data ?? []).map((c) => [c.id, c.title]),
  );

  const top_services: ClientTopService[] = topServiceIds
    .map((service_id) => ({
      service_id,
      service_name: serviceNames.get(service_id) ?? "—",
      count: serviceCounts.get(service_id) ?? 0,
    }))
    .filter((s) => s.count > 0);

  const enrollments: ClientEnrollment[] = (enrollRes.data ?? []).map((e) => ({
    id: e.id,
    course_title: e.course_id ? (courseTitles.get(e.course_id) ?? "—") : "—",
    status: e.status,
    enrolled_at: e.created_at,
  }));

  return {
    client: mapClient(clientRow as Record<string, unknown>),
    stats: {
      appointment_count: apptsRes.data?.length ?? 0,
      completed_count: completed,
      cancelled_count: cancelled,
      no_show_count: noShow,
      upcoming_count: upcoming,
      booking_rate: bookingRate,
      total_spent_cents: totalSpent,
      pos_spent_cents: posSpent,
      ecommerce_spent_cents: ecommerceSpent,
      sale_count: saleCount,
      ecommerce_order_count: ecommerceOrders,
      loyalty_points: (loyaltyRes.data ?? []).reduce(
        (sum, row) => sum + (row.points_balance ?? 0),
        0,
      ),
    },
    top_services,
    enrollments,
  };
}

export async function fetchClientAppointments(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientAppointmentsPayload> {
  const now = new Date().toISOString();

  const { data: rows } = await supabase
    .from("inst_appointments")
    .select("id, starts_at, ends_at, status, price_cents, notes, service_id, staff_id")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false });

  const serviceIds = [
    ...new Set(
      (rows ?? []).map((a) => a.service_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffIds = [
    ...new Set(
      (rows ?? []).map((a) => a.staff_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [servicesRes, staffRes] = await Promise.all([
    serviceIds.length
      ? supabase.from("inst_services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    staffIds.length
      ? supabase.from("inst_staff").select("id, full_name").in("id", staffIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const serviceNames = new Map(
    (servicesRes.data ?? []).map((s) => [s.id, s.name]),
  );
  const staffNames = new Map(
    (staffRes.data ?? []).map((s) => [s.id, s.full_name]),
  );

  const appointments: ClientAppointment[] = (rows ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    price_cents: a.price_cents,
    notes: a.notes,
    service_name: a.service_id ? (serviceNames.get(a.service_id) ?? null) : null,
    staff_name: a.staff_id ? (staffNames.get(a.staff_id) ?? null) : null,
  }));

  return {
    upcoming: appointments
      .filter(
        (a) =>
          a.starts_at >= now &&
          a.status !== "cancelled" &&
          a.status !== "no_show",
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    past: appointments.filter(
      (a) =>
        a.starts_at < now ||
        a.status === "cancelled" ||
        a.status === "no_show",
    ),
  };
}

export async function fetchClientSales(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientSalesPayload> {
  const { data: rows } = await supabase
    .from("inst_sales")
    .select(
      "id, ticket_number, total_cents, status, payment_method, woo_order_id, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  const saleIds = (rows ?? []).map((s) => s.id);
  const { data: itemRows } = saleIds.length
    ? await supabase
        .from("inst_sale_items")
        .select("sale_id, name, quantity, unit_price_cents")
        .in("sale_id", saleIds)
    : { data: [] as Array<{
        sale_id: string;
        name: string;
        quantity: number;
        unit_price_cents: number;
      }> };

  const itemsBySale = new Map<
    string,
    Array<{ name: string; quantity: number; unit_price_cents: number }>
  >();
  for (const item of itemRows ?? []) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    list.push({
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
    });
    itemsBySale.set(item.sale_id, list);
  }

  return {
    sales: (rows ?? []).map((s) => ({
      id: s.id,
      ticket_number: s.ticket_number,
      total_cents: s.total_cents,
      status: s.status,
      payment_method: s.payment_method,
      woo_order_id: s.woo_order_id,
      created_at: s.created_at,
      items: itemsBySale.get(s.id) ?? [],
    })),
  };
}

export async function fetchClientProfile(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientProfile | null> {
  const overview = await fetchClientOverview(supabase, tenantId, clientId);
  if (!overview) return null;

  const [appointments, sales] = await Promise.all([
    fetchClientAppointments(supabase, tenantId, clientId),
    fetchClientSales(supabase, tenantId, clientId),
  ]);

  return {
    ...overview,
    upcoming_appointments: appointments.upcoming,
    past_appointments: appointments.past,
    sales: sales.sales,
  };
}

export function parseClientTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function clientFormFields(formData: FormData) {
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  return {
    full_name: String(formData.get("full_name") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    date_of_birth: dob || null,
    address_line1: String(formData.get("address_line1") ?? "").trim() || null,
    address_line2: String(formData.get("address_line2") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    postal_code: String(formData.get("postal_code") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || "FR",
    notes: String(formData.get("notes") ?? "").trim() || null,
    tags: parseClientTags(String(formData.get("tags") ?? "")),
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
    referred_by_client_id:
      String(formData.get("referred_by_client_id") ?? "").trim() || null,
  };
}
