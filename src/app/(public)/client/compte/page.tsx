import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTenantContext } from "@/lib/tenant/context";
import { getClientSession } from "@/lib/client-auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatDateTime } from "@/lib/utils";
import { ClientPortalPrivacyPanel } from "@/components/compliance/client-portal-privacy-panel";
import { cancelClientAppointment, clientLogout } from "../actions";

const STATUS_KEYS = ["booked", "confirmed", "completed", "cancelled", "no_show"] as const;

export default async function ClientComptePage() {
  const t = await getTranslations("public.client.account");
  const tCommon = await getTranslations("common");
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
    <ListPanel>
      <ListToolbar
        action={
          <form action={clientLogout}>
            <Button variant="outline" type="submit" className="h-9">
              {t("logout")}
            </Button>
          </form>
        }
      >
        <span className="text-sm text-slate-600">{session.email}</span>
      </ListToolbar>

      <DataTable empty={appointments.length === 0 ? t("empty") : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.service")}</th>
              <th className={dataTableHead}>{t("columns.date")}</th>
              <th className={`w-28 ${dataTableHead}`}>{t("columns.status")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className={dataTableRow}>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                  {a.inst_services?.name ?? tCommon("appointment")}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {formatDateTime(a.starts_at)}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {STATUS_KEYS.includes(a.status as (typeof STATUS_KEYS)[number])
                    ? t(`status.${a.status as (typeof STATUS_KEYS)[number]}`)
                    : a.status}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  {a.status !== "cancelled" && a.status !== "completed" ? (
                    <form action={cancelClientAppointment}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="outline" type="submit" className="h-8 text-red-600">
                        {t("cancel")}
                      </Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      <div className="px-4 pb-6 lg:px-6">
        <ClientPortalPrivacyPanel />
      </div>
    </ListPanel>
  );
}
