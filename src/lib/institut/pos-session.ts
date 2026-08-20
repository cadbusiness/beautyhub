import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import {
  calendarDateString,
  isPreviousCalendarDay,
  parseClosedAtInput,
  zonedDateTimeUtc,
} from "@/lib/date";
import { formatTicketNumber, getPosSettings } from "./pos-settings";

type Db = SupabaseClient<Database>;

export interface CashReportSnapshot {
  generated_at: string;
  session_id: string;
  report_type: "x" | "z";
  opening_float_cents: number;
  sales_count: number;
  items_sold_qty: number;
  services_qty: number;
  products_qty: number;
  partial_count: number;
  total_cents: number;
  vat_cents: number;
  amount_paid_cents: number;
  by_payment_method: Record<string, number>;
  movements_in_cents: number;
  movements_out_cents: number;
  movements_expense_cents: number;
  expected_cash_cents: number;
}

export async function getOpenCashSession(supabase: Db, tenantId: string) {
  const { data } = await supabase
    .from("inst_cash_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["open", "paused"])
    .maybeSingle();
  return data;
}

type OpenCashSessionRow = NonNullable<
  Awaited<ReturnType<typeof getOpenCashSession>>
>;

const AUTO_DAY_CLOSE_NOTE = "Clôture automatique — nouvelle journée";

export async function openCashSessionRecord(
  supabase: Db,
  tenantId: string,
  openingFloatCents: number,
): Promise<OpenCashSessionRow> {
  const { data, error } = await supabase
    .from("inst_cash_sessions")
    .insert({
      tenant_id: tenantId,
      opening_float_cents: Math.max(0, Math.round(openingFloatCents)),
      status: "open",
    })
    .select("*")
    .single();
  if (data) return data;
  const concurrent = await getOpenCashSession(supabase, tenantId);
  if (concurrent) return concurrent;
  throw new Error(error?.message ?? "session_open_failed");
}

/** Ouvre la journée en cours (fond par défaut). Clôture hier si encore ouverte. */
export async function ensureTodayCashSession(
  supabase: Db,
  tenantId: string,
): Promise<OpenCashSessionRow> {
  const settings = await getPosSettings(supabase, tenantId);
  const existing = await getOpenCashSession(supabase, tenantId);

  if (existing && !isPreviousCalendarDay(existing.opened_at)) {
    return existing;
  }

  if (existing && isPreviousCalendarDay(existing.opened_at)) {
    const snapshot = await computeSessionSnapshot(
      supabase,
      tenantId,
      existing.id,
      "z",
    );
    await closeOpenCashSession(supabase, tenantId, {
      countedCashCents: snapshot.expected_cash_cents,
      notes: AUTO_DAY_CLOSE_NOTE,
    });
  }

  return openCashSessionRecord(
    supabase,
    tenantId,
    settings.default_opening_float_cents,
  );
}

export function isCashSessionPaused(
  session: { status: string } | null | undefined,
): boolean {
  return session?.status === "paused";
}

export interface PosSessionSummary {
  id: string;
  opened_at: string;
  opening_float_cents: number;
  sales_count: number;
  items_sold_qty: number;
  services_qty: number;
  products_qty: number;
  total_cents: number;
  amount_paid_cents: number;
  expected_cash_cents: number;
  cash_sales_cents: number;
  card_sales_cents: number;
  by_payment_method: Record<string, number>;
  paused: boolean;
  opened_calendar_date: string;
  is_previous_day: boolean;
  last_sale_at: string | null;
  suggested_closed_at: string;
  currency: string;
}

export type MobileCashSessionJson = {
  id: string;
  openedAt: string;
  openingFloatCents: number;
  salesCount: number;
  itemsSoldQty: number;
  servicesQty: number;
  productsQty: number;
  totalCents: number;
  amountPaidCents: number;
  expectedCashCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  byPaymentMethod: Record<string, number>;
  paused: boolean;
  openedCalendarDate: string;
  previousDay: boolean;
  lastSaleAt: string | null;
  suggestedClosedAt: string;
};

export function serializeCashSession(
  summary: PosSessionSummary,
): MobileCashSessionJson {
  return {
    id: summary.id,
    openedAt: summary.opened_at,
    openingFloatCents: summary.opening_float_cents,
    salesCount: summary.sales_count,
    itemsSoldQty: summary.items_sold_qty,
    servicesQty: summary.services_qty,
    productsQty: summary.products_qty,
    totalCents: summary.total_cents,
    amountPaidCents: summary.amount_paid_cents,
    expectedCashCents: summary.expected_cash_cents,
    cashSalesCents: summary.cash_sales_cents,
    cardSalesCents: summary.card_sales_cents,
    byPaymentMethod: summary.by_payment_method,
    paused: summary.paused,
    openedCalendarDate: summary.opened_calendar_date,
    previousDay: summary.is_previous_day,
    lastSaleAt: summary.last_sale_at,
    suggestedClosedAt: summary.suggested_closed_at,
  };
}

/** Résumé session ouverte pour header / accueil (null si fermée). */
export async function getPosSessionSummary(
  supabase: Db,
  tenantId: string,
): Promise<PosSessionSummary | null> {
  const cashSession = await ensureTodayCashSession(supabase, tenantId);
  if (!cashSession) return null;

  const [snapshot, settings, lastSaleRes] = await Promise.all([
    computeSessionSnapshot(supabase, tenantId, cashSession.id, "x"),
    getPosSettings(supabase, tenantId),
    supabase
      .from("inst_sales")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .eq("cash_session_id", cashSession.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastSaleAt = lastSaleRes.data?.created_at ?? null;
  const openedCalendarDate = calendarDateString(cashSession.opened_at);
  const cashSalesCents = snapshot.by_payment_method.cash ?? 0;
  const cardSalesCents =
    (snapshot.by_payment_method.card ?? 0) + (snapshot.by_payment_method.stripe ?? 0);
  return {
    id: cashSession.id,
    opened_at: cashSession.opened_at,
    opening_float_cents: cashSession.opening_float_cents,
    sales_count: snapshot.sales_count,
    items_sold_qty: snapshot.items_sold_qty,
    services_qty: snapshot.services_qty,
    products_qty: snapshot.products_qty,
    total_cents: snapshot.total_cents,
    amount_paid_cents: snapshot.amount_paid_cents,
    expected_cash_cents: snapshot.expected_cash_cents,
    cash_sales_cents: cashSalesCents,
    card_sales_cents: cardSalesCents,
    by_payment_method: snapshot.by_payment_method,
    paused: isCashSessionPaused(cashSession),
    opened_calendar_date: openedCalendarDate,
    is_previous_day: isPreviousCalendarDay(cashSession.opened_at),
    last_sale_at: lastSaleAt,
    suggested_closed_at: suggestedSessionClosedAt({
      openedAt: cashSession.opened_at,
      lastSaleAt,
    }),
    currency: settings.currency,
  };
}

export function suggestedSessionClosedAt(input: {
  openedAt: string;
  lastSaleAt: string | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const previousDay =
    calendarDateString(input.openedAt) < calendarDateString(now);
  return resolveSessionClosedAt({
    openedAt: input.openedAt,
    lastSaleAt: input.lastSaleAt,
    requested: previousDay
      ? zonedDateTimeUtc(calendarDateString(input.openedAt), 19, 0).toISOString()
      : now.toISOString(),
    now,
  });
}

export function resolveSessionClosedAt(input: {
  openedAt: string;
  lastSaleAt?: string | null;
  requested?: string | Date | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const opened = new Date(input.openedAt);
  const lastSale = input.lastSaleAt ? new Date(input.lastSaleAt) : null;
  const requested =
    input.requested instanceof Date
      ? input.requested
      : typeof input.requested === "string"
        ? (parseClosedAtInput(input.requested) ?? now)
        : now;

  const floor =
    lastSale && lastSale.getTime() > opened.getTime() ? lastSale : opened;
  const clamped = new Date(
    Math.min(now.getTime(), Math.max(floor.getTime(), requested.getTime())),
  );
  return clamped.toISOString();
}

export async function requireOpenSessionIfNeeded(
  supabase: Db,
  tenantId: string,
): Promise<string | null> {
  const session = await ensureTodayCashSession(supabase, tenantId);
  if (isCashSessionPaused(session)) throw new Error("session_paused");
  return session.id;
}

export async function computeSessionSnapshot(
  supabase: Db,
  tenantId: string,
  sessionId: string,
  reportType: "x" | "z",
): Promise<CashReportSnapshot> {
  const { data: session } = await supabase
    .from("inst_cash_sessions")
    .select("id, opening_float_cents")
    .eq("tenant_id", tenantId)
    .eq("id", sessionId)
    .single();
  if (!session) throw new Error("session_not_found");

  const { data: sales } = await supabase
    .from("inst_sales")
    .select("id, total_cents, vat_cents, amount_paid_cents, status")
    .eq("tenant_id", tenantId)
    .eq("cash_session_id", sessionId)
    .neq("sale_kind", "refund");

  const saleIds = (sales ?? []).map((s) => s.id);
  let byMethod: Record<string, number> = {};
  let itemsSoldQty = 0;
  let servicesQty = 0;
  let productsQty = 0;
  if (saleIds.length > 0) {
    const [{ data: payments }, { data: items }] = await Promise.all([
      supabase
        .from("inst_sale_payments")
        .select("method, amount_cents")
        .eq("tenant_id", tenantId)
        .in("sale_id", saleIds),
      supabase
        .from("inst_sale_items")
        .select("quantity, item_type")
        .eq("tenant_id", tenantId)
        .in("sale_id", saleIds),
    ]);
    for (const p of payments ?? []) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount_cents;
    }
    for (const item of items ?? []) {
      const qty = Number(item.quantity) || 0;
      itemsSoldQty += qty;
      if (item.item_type === "service") servicesQty += qty;
      else productsQty += qty;
    }
  }

  const { data: movements } = await supabase
    .from("inst_cash_movements")
    .select("movement_type, amount_cents")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId);

  let movementsIn = 0;
  let movementsOut = 0;
  let movementsExpense = 0;
  for (const m of movements ?? []) {
    if (m.movement_type === "in") movementsIn += m.amount_cents;
    else if (m.movement_type === "out") movementsOut += m.amount_cents;
    else movementsExpense += m.amount_cents;
  }

  const cashSales = byMethod.cash ?? 0;
  const expectedCash =
    session.opening_float_cents + cashSales + movementsIn - movementsOut - movementsExpense;

  return {
    generated_at: new Date().toISOString(),
    session_id: sessionId,
    report_type: reportType,
    opening_float_cents: session.opening_float_cents,
    sales_count: sales?.length ?? 0,
    items_sold_qty: itemsSoldQty,
    services_qty: servicesQty,
    products_qty: productsQty,
    partial_count: (sales ?? []).filter((s) => s.status === "partial").length,
    total_cents: (sales ?? []).reduce((s, r) => s + r.total_cents, 0),
    vat_cents: (sales ?? []).reduce((s, r) => s + (r.vat_cents ?? 0), 0),
    amount_paid_cents: (sales ?? []).reduce((s, r) => s + (r.amount_paid_cents ?? 0), 0),
    by_payment_method: byMethod,
    movements_in_cents: movementsIn,
    movements_out_cents: movementsOut,
    movements_expense_cents: movementsExpense,
    expected_cash_cents: expectedCash,
  };
}

export async function nextReportNumber(
  supabase: Db,
  tenantId: string,
  reportType: "x" | "z",
  prefix: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", {
    p_tenant_id: tenantId,
    p_doc_type: `report_${reportType}`,
  });
  if (error || data == null) throw new Error(error?.message ?? "report_number_failed");
  return formatTicketNumber(prefix, data as number);
}

export function generateGiftCardCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${code}`;
}

export async function pauseOpenCashSession(supabase: Db, tenantId: string) {
  const session = await getOpenCashSession(supabase, tenantId);
  if (!session) throw new Error("no_open_session");
  if (session.status === "paused") return { id: session.id, paused: true as const };

  const { error } = await supabase
    .from("inst_cash_sessions")
    .update({ status: "paused" })
    .eq("id", session.id)
    .eq("tenant_id", tenantId)
    .eq("status", "open");
  if (error) throw new Error(error.message);
  return { id: session.id, paused: true as const };
}

export async function resumePausedCashSession(supabase: Db, tenantId: string) {
  const session = await getOpenCashSession(supabase, tenantId);
  if (!session) throw new Error("no_open_session");
  if (session.status === "open") return { id: session.id, paused: false as const };

  const { error } = await supabase
    .from("inst_cash_sessions")
    .update({ status: "open" })
    .eq("id", session.id)
    .eq("tenant_id", tenantId)
    .eq("status", "paused");
  if (error) throw new Error(error.message);
  return { id: session.id, paused: false as const };
}

export async function closeOpenCashSession(
  supabase: Db,
  tenantId: string,
  input: { countedCashCents: number; notes?: string | null; closedAt?: string | null },
): Promise<{ reportId: string; reportNumber: string; varianceCents: number }> {
  const cashSession = await getOpenCashSession(supabase, tenantId);
  if (!cashSession) throw new Error("no_open_session");

  const { data: lastSale } = await supabase
    .from("inst_sales")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("cash_session_id", cashSession.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const closedAt = resolveSessionClosedAt({
    openedAt: cashSession.opened_at,
    lastSaleAt: lastSale?.created_at ?? null,
    requested: input.closedAt,
  });

  const countedCash = Math.max(0, Math.round(input.countedCashCents));
  const notes = input.notes?.trim() || null;

  const snapshot = await computeSessionSnapshot(
    supabase,
    tenantId,
    cashSession.id,
    "z",
  );
  const reportNumber = await nextReportNumber(supabase, tenantId, "z", "Z");
  const variance = countedCash - snapshot.expected_cash_cents;

  if (variance !== 0 && !notes) throw new Error("variance_notes_required");

  const { data: report, error: reportErr } = await supabase
    .from("inst_cash_reports")
    .insert({
      tenant_id: tenantId,
      session_id: cashSession.id,
      report_type: "z",
      report_number: reportNumber,
      snapshot: {
        ...snapshot,
        closing_counted_cents: countedCash,
        variance_cents: variance,
      } as unknown as Json,
    })
    .select("id")
    .single();
  if (reportErr || !report) {
    throw new Error(reportErr?.message ?? "report_failed");
  }

  const { error: closeErr } = await supabase
    .from("inst_cash_sessions")
    .update({
      status: "closed",
      closed_at: closedAt,
      closing_counted_cents: countedCash,
      closing_expected_cents: snapshot.expected_cash_cents,
      closing_variance_cents: variance,
      z_report_number: reportNumber,
      notes,
    })
    .eq("id", cashSession.id)
    .eq("tenant_id", tenantId);
  if (closeErr) throw new Error(closeErr.message);

  return { reportId: report.id, reportNumber, varianceCents: variance };
}
