import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant/context";
import { getClientSession } from "@/lib/client-auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel } from "@/components/ui/list-panel";
import { formatDateTime } from "@/lib/utils";
import { cancelClientAppointment, clientLogout } from "../actions";

const STATUS: Record<string, string> = {
  booked: "Reserve",
  confirmed: "Confirme",
  completed: "Termine",
  cancelled: "Annule",
  no_show: "Absent",
};

export default async function ClientComptePage() {
  const tenant = await getTenantContext();
  if (!tenant) redirect("/");

  const session = await getClientSession(tenant.id);
  if (!session) redirect("/client/login");

  let appointments: Array<{
    id: string;
    starts_at: string;
    status: string;
    inst_services: { name: string } | null;
  }> = [];

  try {
    const db = createServiceClient();
    const { data } = await db
      .from("inst_appointments")
      .select("id, starts_at, status, inst_services(name)")
      .eq("tenant_id", tenant.id)
      .eq("client_id", session.clientId)
      .gte("starts_at", new Date().toISOString())
      .not("status", "eq", "cancelled")
      .order("starts_at");
    appointments = (data ?? []) as typeof appointments;
  } catch {
    /* service role absent en dev */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Mes rendez-vous" description={session.email} />
        <form action={clientLogout}>
          <Button variant="outline" type="submit" className="h-9">
            Deconnexion
          </Button>
        </form>
      </div>

      <ListPanel>
        <DataTable
        empty={
          appointments.length === 0 ? "Aucun rendez-vous a venir." : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>Prestation</th>
              <th className={dataTableHead}>Date</th>
              <th className={`w-28 ${dataTableHead}`}>Statut</th>
              <th className={`w-28 text-right ${dataTableHead}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className={dataTableRow}>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                  {a.inst_services?.name ?? "Rendez-vous"}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {formatDateTime(a.starts_at)}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {STATUS[a.status] ?? a.status}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  {a.status !== "cancelled" && a.status !== "completed" ? (
                    <form action={cancelClientAppointment}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="outline" type="submit" className="h-8 text-red-600">
                        Annuler
                      </Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </DataTable>
      </ListPanel>
    </div>
  );
}
