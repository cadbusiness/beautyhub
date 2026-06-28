import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type DashboardPeriod = "today" | "week" | "month" | "year";

export type HealthMood = "great" | "good" | "ok" | "low";

export type DashboardTodaySummary = {
  revenueCents: number;
  salesCount: number;
  appointmentsScheduled: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  appointmentsNoShow: number;
  newClients: number;
  cancellationRate: number;
  healthScore: number;
  mood: HealthMood;
};

export type DashboardSeriesPoint = {
  key: string;
  label: string;
  revenueCents: number;
  salesCount: number;
  appointments: number;
  cancelled: number;
  completed: number;
  noShow: number;
};

export type DashboardPeriodStats = {
  period: DashboardPeriod;
  revenueCents: number;
  revenueChangePct: number | null;
  salesCount: number;
  salesChangePct: number | null;
  appointmentsTotal: number;
  appointmentsCancelled: number;
  appointmentsCompleted: number;
  appointmentsNoShow: number;
  cancellationRate: number;
  newClients: number;
  series: DashboardSeriesPoint[];
};

export type DashboardSnapshot = {
  today: DashboardTodaySummary;
  analytics: DashboardPeriodStats;
};

type DateRange = { start: Date; end: Date };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function getRange(period: DashboardPeriod, now = new Date()): DateRange {
  const end = now;
  switch (period) {
    case "today":
      return { start: startOfDay(now), end };
    case "week":
      return { start: startOfDay(addDays(now, -6)), end };
    case "month":
      return { start: startOfDay(addDays(now, -29)), end };
    case "year": {
      const start = startOfDay(now);
      start.setDate(1);
      start.setMonth(start.getMonth() - 11);
      return { start, end };
    }
  }
}

function getPreviousRange(period: DashboardPeriod, now = new Date()): DateRange {
  switch (period) {
    case "today": {
      const yesterday = addDays(now, -1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case "week":
      return {
        start: startOfDay(addDays(now, -13)),
        end: endOfDay(addDays(now, -7)),
      };
    case "month":
      return {
        start: startOfDay(addDays(now, -59)),
        end: endOfDay(addDays(now, -30)),
      };
    case "year": {
      const end = endOfDay(now);
      end.setFullYear(end.getFullYear() - 1);
      end.setMonth(11);
      end.setDate(31);
      const start = startOfDay(end);
      start.setMonth(0);
      start.setDate(1);
      return { start, end };
    }
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function computeHealthScore(input: {
  revenueCents: number;
  previousRevenueCents: number;
  cancellationRate: number;
  completed: number;
  cancelled: number;
}): { score: number; mood: HealthMood } {
  let score = 65;

  if (input.revenueCents > input.previousRevenueCents) score += 15;
  else if (input.revenueCents > 0 && input.previousRevenueCents === 0) score += 10;
  else if (input.revenueCents < input.previousRevenueCents) score -= 8;

  if (input.cancellationRate <= 5) score += 12;
  else if (input.cancellationRate <= 15) score += 5;
  else if (input.cancellationRate >= 30) score -= 18;
  else if (input.cancellationRate >= 20) score -= 10;

  if (input.completed > input.cancelled) score += 8;
  if (input.revenueCents > 0) score += 5;

  score = Math.max(0, Math.min(100, score));

  let mood: HealthMood = "low";
  if (score >= 85) mood = "great";
  else if (score >= 70) mood = "good";
  else if (score >= 50) mood = "ok";

  return { score, mood };
}

function cancellationRate(cancelled: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((cancelled / total) * 100);
}

function bucketKey(date: Date, period: DashboardPeriod): string {
  switch (period) {
    case "today":
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    case "week":
    case "month":
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    case "year":
      return `${date.getFullYear()}-${date.getMonth()}`;
  }
}

function formatBucketLabel(date: Date, period: DashboardPeriod, locale: string): string {
  switch (period) {
    case "today":
      return new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(date);
    case "week":
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
    case "month":
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
    case "year":
      return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
  }
}

function buildBuckets(range: DateRange, period: DashboardPeriod, locale: string): DashboardSeriesPoint[] {
  const buckets: DashboardSeriesPoint[] = [];

  if (period === "today") {
    const dayStart = startOfDay(range.start);
    for (let h = 0; h < 24; h += 2) {
      const d = new Date(dayStart);
      d.setHours(h);
      buckets.push({
        key: bucketKey(d, period),
        label: formatBucketLabel(d, period, locale),
        revenueCents: 0,
        salesCount: 0,
        appointments: 0,
        cancelled: 0,
        completed: 0,
        noShow: 0,
      });
    }
    return buckets;
  }

  if (period === "year") {
    const cursor = new Date(range.start);
    cursor.setDate(1);
    for (let i = 0; i < 12; i++) {
      const d = addMonths(cursor, i);
      buckets.push({
        key: bucketKey(d, period),
        label: formatBucketLabel(d, period, locale),
        revenueCents: 0,
        salesCount: 0,
        appointments: 0,
        cancelled: 0,
        completed: 0,
        noShow: 0,
      });
    }
    return buckets;
  }

  const days = period === "week" ? 7 : 30;
  for (let i = 0; i < days; i++) {
    const d = addDays(startOfDay(range.start), i);
    buckets.push({
      key: bucketKey(d, period),
      label: formatBucketLabel(d, period, locale),
      revenueCents: 0,
      salesCount: 0,
      appointments: 0,
      cancelled: 0,
      completed: 0,
      noShow: 0,
    });
  }
  return buckets;
}

function resolveBucketIndex(date: Date, period: DashboardPeriod, range: DateRange): number {
  if (period === "today") {
    return Math.min(11, Math.floor(date.getHours() / 2));
  }
  if (period === "year") {
    const startMonth = range.start.getFullYear() * 12 + range.start.getMonth();
    const dateMonth = date.getFullYear() * 12 + date.getMonth();
    return dateMonth - startMonth;
  }
  const dayStart = startOfDay(range.start).getTime();
  const diff = Math.floor((startOfDay(date).getTime() - dayStart) / 86_400_000);
  return diff;
}

function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

async function fetchSalesInRange(
  supabase: Db,
  tenantId: string,
  range: DateRange,
) {
  const { data } = await supabase
    .from("inst_sales")
    .select("total_cents, created_at")
    .eq("tenant_id", tenantId)
    .neq("sale_kind", "refund")
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());

  return data ?? [];
}

async function fetchAppointmentsInRange(
  supabase: Db,
  tenantId: string,
  range: DateRange,
) {
  const { data } = await supabase
    .from("inst_appointments")
    .select("status, starts_at")
    .eq("tenant_id", tenantId)
    .gte("starts_at", range.start.toISOString())
    .lte("starts_at", range.end.toISOString());

  return data ?? [];
}

async function fetchNewClientsInRange(
  supabase: Db,
  tenantId: string,
  range: DateRange,
) {
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());

  return count ?? 0;
}

function aggregatePeriodStats(
  period: DashboardPeriod,
  range: DateRange,
  previousRange: DateRange,
  sales: { total_cents: number; created_at: string }[],
  appointments: { status: string; starts_at: string }[],
  newClients: number,
  previousSales: { total_cents: number }[],
  previousAppointments: { status: string }[],
  locale: string,
): DashboardPeriodStats {
  const series = buildBuckets(range, period, locale);

  let revenueCents = 0;
  let salesCount = 0;

  for (const sale of sales) {
    if (!inRange(sale.created_at, range)) continue;
    revenueCents += sale.total_cents;
    salesCount += 1;
    const idx = resolveBucketIndex(new Date(sale.created_at), period, range);
    if (idx >= 0 && idx < series.length) {
      series[idx].revenueCents += sale.total_cents;
      series[idx].salesCount += 1;
    }
  }

  let appointmentsTotal = 0;
  let appointmentsCancelled = 0;
  let appointmentsCompleted = 0;
  let appointmentsNoShow = 0;

  for (const appt of appointments) {
    if (!inRange(appt.starts_at, range)) continue;
    appointmentsTotal += 1;
    const idx = resolveBucketIndex(new Date(appt.starts_at), period, range);

    if (appt.status === "cancelled") {
      appointmentsCancelled += 1;
      if (idx >= 0 && idx < series.length) series[idx].cancelled += 1;
    } else if (appt.status === "completed") {
      appointmentsCompleted += 1;
      if (idx >= 0 && idx < series.length) series[idx].completed += 1;
    } else if (appt.status === "no_show") {
      appointmentsNoShow += 1;
      if (idx >= 0 && idx < series.length) series[idx].noShow += 1;
    }

    if (idx >= 0 && idx < series.length) series[idx].appointments += 1;
  }

  const prevRevenue = previousSales.reduce((s, r) => s + r.total_cents, 0);
  const prevSalesCount = previousSales.length;
  const prevCancelled = previousAppointments.filter((a) => a.status === "cancelled").length;
  const prevTotal = previousAppointments.length;

  return {
    period,
    revenueCents,
    revenueChangePct: pctChange(revenueCents, prevRevenue),
    salesCount,
    salesChangePct: pctChange(salesCount, prevSalesCount),
    appointmentsTotal,
    appointmentsCancelled,
    appointmentsCompleted,
    appointmentsNoShow,
    cancellationRate: cancellationRate(appointmentsCancelled, appointmentsTotal),
    newClients,
    series,
  };
}

function buildTodaySummary(
  sales: { total_cents: number }[],
  appointments: { status: string }[],
  newClients: number,
  previousSales: { total_cents: number }[],
): DashboardTodaySummary {
  const revenueCents = sales.reduce((s, r) => s + r.total_cents, 0);
  const salesCount = sales.length;

  const appointmentsScheduled = appointments.filter(
    (a) => a.status !== "cancelled",
  ).length;
  const appointmentsCompleted = appointments.filter((a) => a.status === "completed").length;
  const appointmentsCancelled = appointments.filter((a) => a.status === "cancelled").length;
  const appointmentsNoShow = appointments.filter((a) => a.status === "no_show").length;
  const rate = cancellationRate(appointmentsCancelled, appointments.length);

  const prevRevenue = previousSales.reduce((s, r) => s + r.total_cents, 0);

  const { score, mood } = computeHealthScore({
    revenueCents,
    previousRevenueCents: prevRevenue,
    cancellationRate: rate,
    completed: appointmentsCompleted,
    cancelled: appointmentsCancelled,
  });

  return {
    revenueCents,
    salesCount,
    appointmentsScheduled,
    appointmentsCompleted,
    appointmentsCancelled,
    appointmentsNoShow,
    newClients,
    cancellationRate: rate,
    healthScore: score,
    mood,
  };
}

export async function fetchDashboardSnapshot(
  supabase: Db,
  tenantId: string,
  period: DashboardPeriod = "week",
  locale = "fr",
): Promise<DashboardSnapshot> {
  const now = new Date();
  const todayRange = getRange("today", now);
  const yesterdayRange = getPreviousRange("today", now);
  const periodRange = getRange(period, now);
  const previousPeriodRange = getPreviousRange(period, now);

  const [
    todaySales,
    yesterdaySales,
    periodSales,
    previousPeriodSales,
    todayAppointments,
    periodAppointments,
    previousPeriodAppointments,
    todayClients,
    periodClients,
  ] = await Promise.all([
    fetchSalesInRange(supabase, tenantId, todayRange),
    fetchSalesInRange(supabase, tenantId, yesterdayRange),
    fetchSalesInRange(supabase, tenantId, periodRange),
    fetchSalesInRange(supabase, tenantId, previousPeriodRange),
    fetchAppointmentsInRange(supabase, tenantId, todayRange),
    fetchAppointmentsInRange(supabase, tenantId, periodRange),
    fetchAppointmentsInRange(supabase, tenantId, previousPeriodRange),
    fetchNewClientsInRange(supabase, tenantId, todayRange),
    fetchNewClientsInRange(supabase, tenantId, periodRange),
  ]);

  return {
    today: buildTodaySummary(
      todaySales,
      todayAppointments,
      todayClients,
      yesterdaySales,
    ),
    analytics: aggregatePeriodStats(
      period,
      periodRange,
      previousPeriodRange,
      periodSales,
      periodAppointments,
      periodClients,
      previousPeriodSales,
      previousPeriodAppointments,
      locale,
    ),
  };
}

export function parseDashboardPeriod(value: string | null): DashboardPeriod {
  if (value === "today" || value === "week" || value === "month" || value === "year") {
    return value;
  }
  return "week";
}
