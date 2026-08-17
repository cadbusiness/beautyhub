import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { VouchersManager, type UnifiedVoucherRow } from "./vouchers-manager";

export default async function CaisseBonsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [
    { data: vouchers },
    { data: giftCards },
    { data: creditNotes },
    { data: partialSales },
    { data: templates },
    settings,
  ] = await Promise.all([
    supabase
      .from("inst_vouchers")
      .select(
        "id, code, voucher_type, current_balance_cents, initial_amount_cents, status, source_channel, recipient_name, expires_at, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("inst_gift_cards")
      .select(
        "id, code, balance_cents, initial_balance_cents, status, recipient_name, expires_at, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("inst_credit_notes")
      .select(
        "id, credit_number, remaining_cents, amount_cents, status, reason, expires_at, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("inst_sales")
      .select("id, ticket_number, amount_paid_cents, status, created_at")
      .eq("tenant_id", tenantId)
      .in("status", ["paid", "partial"])
      .gt("amount_paid_cents", 0)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inst_voucher_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    getPosSettings(supabase, tenantId),
  ]);

  const unified: UnifiedVoucherRow[] = [
    ...(vouchers ?? []).map((v) => ({
      id: v.id,
      kind:
        (v.voucher_type as "voucher" | "gift_card" | "credit_note") ??
        "voucher",
      source: "unified" as const,
      code: v.code,
      balance_cents: v.current_balance_cents,
      initial_cents: v.initial_amount_cents,
      status: v.status,
      recipient_or_reason: v.recipient_name,
      created_at: v.created_at,
      expires_at: v.expires_at,
    })),
    ...(giftCards ?? []).map((g) => ({
      id: g.id,
      kind: "gift_card" as const,
      source: "legacy_gift_card" as const,
      code: g.code,
      balance_cents: g.balance_cents,
      initial_cents: g.initial_balance_cents,
      status: g.status,
      recipient_or_reason: g.recipient_name,
      created_at: g.created_at,
      expires_at: g.expires_at,
    })),
    ...(creditNotes ?? []).map((n) => ({
      id: n.id,
      kind: "credit_note" as const,
      source: "legacy_credit_note" as const,
      code: n.credit_number,
      balance_cents: n.remaining_cents,
      initial_cents: n.amount_cents,
      status: n.status,
      recipient_or_reason: n.reason,
      created_at: n.created_at,
      expires_at: n.expires_at,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const sales = (partialSales ?? []).map((s) => ({
    id: s.id,
    ticket_number: s.ticket_number,
    amount_paid_cents: s.amount_paid_cents,
  }));

  return (
    <VouchersManager
      vouchers={unified}
      templates={templates ?? []}
      sales={sales}
      currency={settings.currency}
    />
  );
}
