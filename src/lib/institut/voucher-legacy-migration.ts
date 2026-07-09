import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export interface VoucherMigrationSnapshot {
  legacyTotalCents: number;
  voucherTotalCents: number;
  deltaCents: number;
}

export async function computeVoucherMigrationSnapshot(
  supabase: Db,
  tenantId: string,
): Promise<VoucherMigrationSnapshot> {
  const [{ data: legacy }, { data: vouchers }] = await Promise.all([
    supabase
      .from("inst_legacy_vouchers")
      .select("current_balance_cents")
      .eq("tenant_id", tenantId),
    supabase
      .from("inst_vouchers")
      .select("current_balance_cents")
      .eq("tenant_id", tenantId)
      .eq("source_channel", "legacy"),
  ]);

  const legacyTotalCents = (legacy ?? []).reduce(
    (sum, row) => sum + (row.current_balance_cents ?? 0),
    0,
  );
  const voucherTotalCents = (vouchers ?? []).reduce(
    (sum, row) => sum + row.current_balance_cents,
    0,
  );

  return {
    legacyTotalCents,
    voucherTotalCents,
    deltaCents: voucherTotalCents - legacyTotalCents,
  };
}

export async function listUnlinkedLegacyVoucherCodes(
  supabase: Db,
  tenantId: string,
): Promise<string[]> {
  const { data: links } = await supabase
    .from("inst_voucher_links")
    .select("legacy_type, legacy_id")
    .eq("tenant_id", tenantId)
    .not("legacy_id", "is", null);
  const linked = new Set(
    (links ?? []).map((row) => `${row.legacy_type ?? ""}:${row.legacy_id ?? ""}`),
  );

  const { data: legacy } = await supabase
    .from("inst_legacy_vouchers")
    .select("legacy_type, legacy_id, code")
    .eq("tenant_id", tenantId);

  return (legacy ?? [])
    .filter((row) => !linked.has(`${row.legacy_type ?? ""}:${row.legacy_id ?? ""}`))
    .map((row) => row.code ?? "")
    .filter(Boolean);
}
