import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  fetchClientAppointments,
  fetchClientOverview,
  fetchClientSales,
} from "@/lib/institut/clients";

type Db = SupabaseClient<Database>;

export type ClientDataExport = {
  exported_at: string;
  tenant_id: string;
  client_id: string;
  profile: Record<string, unknown> | null;
  consent_events: Array<Record<string, unknown>>;
  appointments: Record<string, unknown>;
  sales: Record<string, unknown>;
  loyalty: {
    balance: Record<string, unknown> | null;
    transactions: Array<Record<string, unknown>>;
  };
};

export async function exportClientData(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientDataExport | null> {
  const overview = await fetchClientOverview(supabase, tenantId, clientId);
  if (!overview) return null;

  const { client } = overview;
  const [appointments, sales, consentRes, loyaltyBalanceRes, loyaltyTxRes] =
    await Promise.all([
      fetchClientAppointments(supabase, tenantId, clientId),
      fetchClientSales(supabase, tenantId, clientId),
      supabase
        .from("consent_events")
        .select(
          "consent_type, granted, source, actor_type, created_at, ip_address",
        )
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("inst_loyalty_balances")
        .select("points_balance, updated_at")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("inst_loyalty_transactions")
        .select("type, points_delta, balance_after, source_type, created_at, notes")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const { pin_code: _pinCode, ...safeClient } = client;

  return {
    exported_at: new Date().toISOString(),
    tenant_id: tenantId,
    client_id: clientId,
    profile: safeClient as unknown as Record<string, unknown>,
    consent_events: consentRes.data ?? [],
    appointments: appointments as unknown as Record<string, unknown>,
    sales: sales as unknown as Record<string, unknown>,
    loyalty: {
      balance: loyaltyBalanceRes.data as Record<string, unknown> | null,
      transactions: (loyaltyTxRes.data ?? []) as Array<Record<string, unknown>>,
    },
  };
}

export function serializeClientExport(data: ClientDataExport): string {
  return JSON.stringify(data, null, 2);
}

export function clientExportFilename(clientId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `beautyhub-client-${clientId.slice(0, 8)}-${date}.json`;
}
