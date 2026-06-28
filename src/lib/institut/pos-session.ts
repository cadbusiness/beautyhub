import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { formatTicketNumber, getPosSettings } from "./pos-settings";

type Db = SupabaseClient<Database>;

export interface CashReportSnapshot {
  generated_at: string;
  session_id: string;
  report_type: "x" | "z";
  opening_float_cents: number;
  sales_count: number;
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
    .eq("status", "open")
    .maybeSingle();
  return data;
}

export async function requireOpenSessionIfNeeded(
  supabase: Db,
  tenantId: string,
): Promise<string | null> {
  const settings = await getPosSettings(supabase, tenantId);
  if (!settings.require_open_session) return null;
  const session = await getOpenCashSession(supabase, tenantId);
  if (!session) throw new Error("no_open_session");
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
  if (saleIds.length > 0) {
    const { data: payments } = await supabase
      .from("inst_sale_payments")
      .select("method, amount_cents")
      .eq("tenant_id", tenantId)
      .in("sale_id", saleIds);
    for (const p of payments ?? []) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount_cents;
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
