import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatPrice } from "@/lib/utils";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Especes",
  card: "Carte TPE",
  stripe: "Stripe",
};

export default async function CaisseHistoriquePage() {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: sales } = await supabase
    .from("inst_sales")
    .select(
      `
 id,
 total_cents,
 payment_method,
 status,
 woo_order_id,
 notes,
 created_at,
 clients ( full_name, email ),
 inst_sale_items ( name, quantity, unit_price_cents, item_type )
 `,
    )
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <ListPanel>
      <ListToolbar
        action={
          <Link href="/institut/caisse">
            <Button variant="outline" type="button" className="h-9">
              Retour caisse
            </Button>
          </Link>
        }
      >
        <span className="text-sm text-slate-500">Historique des ventes</span>
      </ListToolbar>

      <DataTable empty={(sales ?? []).length === 0 ? "Aucune vente enregistree." : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>Date</th>
              <th className={dataTableHead}>Client</th>
              <th className={dataTableHead}>Articles</th>
              <th className={`w-28 ${dataTableHead}`}>Paiement</th>
              <th className={`w-28 text-right ${dataTableHead}`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(sales ?? []).map((sale) => {
              const client = sale.clients as {
                full_name: string | null;
                email: string;
              } | null;
              const items = (sale.inst_sale_items ?? []) as Array<{
                name: string;
                quantity: number;
                unit_price_cents: number;
                item_type: string;
              }>;
              const date = new Date(sale.created_at).toLocaleString("fr-FR", {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const payment =
                PAYMENT_LABEL[sale.payment_method ?? "cash"] ?? sale.payment_method;
              const itemsSummary = items
                .map((item) => `${item.quantity}× ${item.name}`)
                .join(", ");

              return (
                <tr key={sale.id} className={dataTableRow}>
                  <td className={`whitespace-nowrap text-slate-900 ${dataTableCell}`}>
                    {date}
                  </td>
                  <td className={dataTableCell}>
                    {client ? (
                      <>
                        <p className="text-slate-900">{client.full_name ?? client.email}</p>
                        {client.full_name ? (
                          <p className="text-xs text-slate-500">{client.email}</p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className={`max-w-0 ${dataTableCell}`}>
                    <p className="truncate text-slate-600" title={itemsSummary}>
                      {itemsSummary || "—"}
                    </p>
                    {sale.notes ? (
                      <p className="truncate text-xs italic text-slate-400">{sale.notes}</p>
                    ) : null}
                  </td>
                  <td className={`text-slate-600 ${dataTableCell}`}>{payment}</td>
                  <td
                    className={`whitespace-nowrap text-right font-medium tabular-nums text-slate-900 ${dataTableCell}`}
                  >
                    {formatPrice(sale.total_cents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>
    </ListPanel>
  );
}
