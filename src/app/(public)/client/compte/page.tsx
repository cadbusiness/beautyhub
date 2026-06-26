import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant/context";
import { getClientSession } from "@/lib/client-auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Mes rendez-vous</h1>
          <p className="text-sm text-slate-500">{session.email}</p>
        </div>
        <form action={clientLogout}>
          <Button variant="outline" type="submit">
            Deconnexion
          </Button>
        </form>
      </div>

      {appointments.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Aucun rendez-vous a venir.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {a.inst_services?.name ?? "Rendez-vous"}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDateTime(a.starts_at)} · {STATUS[a.status] ?? a.status}
                </p>
              </div>
              {a.status !== "cancelled" && a.status !== "completed" ? (
                <form action={cancelClientAppointment}>
                  <input type="hidden" name="id" value={a.id} />
                  <Button variant="outline" type="submit" className="text-red-600">
                    Annuler
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
