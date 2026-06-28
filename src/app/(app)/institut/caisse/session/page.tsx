import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import {
  computeSessionSnapshot,
  getOpenCashSession,
} from "@/lib/institut/pos-session";
import { formatPrice } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { OpenSessionForm } from "./open-session-form";
import { MovementForm } from "./movement-form";
import { CloseSessionForm } from "./close-session-form";
import { XReportButton } from "./x-report-button";

export default async function CaisseSessionPage() {
  const t = await getTranslations("pos.session");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const cashSession = await getOpenCashSession(supabase, tenantId);

  const [settings, movementsRes, reportsRes] = await Promise.all([
    getPosSettings(supabase, tenantId),
    cashSession
      ? supabase
          .from("inst_cash_movements")
          .select("id, movement_type, amount_cents, reason, created_at")
          .eq("session_id", cashSession.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; movement_type: string; amount_cents: number; reason: string; created_at: string }> }),
    cashSession
      ? supabase
          .from("inst_cash_reports")
          .select("id, report_type, report_number, created_at")
          .eq("session_id", cashSession.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; report_type: string; report_number: string; created_at: string }> }),
  ]);

  let snapshot = null;
  if (cashSession) {
    snapshot = await computeSessionSnapshot(
      supabase,
      tenantId,
      cashSession.id,
      "x",
    );
  }

  const movements = movementsRes.data ?? [];
  const reports = reportsRes.data ?? [];

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      {!cashSession ? (
        <Card className="space-y-4">
          <div>
            <h2 className="font-medium text-slate-900">{t("openTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("openDescription")}</p>
          </div>
          <OpenSessionForm defaultFloat={settings.default_opening_float_cents} />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{t("sessionOpen")}</p>
              <p className="text-lg font-medium text-slate-900">
                {format.dateTime(new Date(cashSession.opened_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="text-sm text-slate-500">
                {t("openingFloat")}: {formatPrice(cashSession.opening_float_cents)}
              </p>
            </div>
            <XReportButton />
          </div>

          {snapshot ? (
            <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t("stats.sales")} value={String(snapshot.sales_count)} />
              <Stat
                label={t("stats.total")}
                value={formatPrice(snapshot.total_cents)}
              />
              <Stat
                label={t("stats.expectedCash")}
                value={formatPrice(snapshot.expected_cash_cents)}
              />
              <Stat
                label={t("stats.partial")}
                value={String(snapshot.partial_count)}
              />
            </Card>
          ) : null}

          {snapshot && Object.keys(snapshot.by_payment_method).length > 0 ? (
            <Card className="space-y-2">
              <h3 className="text-sm font-medium text-slate-900">{t("byPayment")}</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(snapshot.by_payment_method).map(([method, cents]) => (
                  <li key={method} className="flex justify-between text-slate-600">
                    <span>{t(`methods.${method as "cash"}`, { defaultValue: method })}</span>
                    <span className="tabular-nums">{formatPrice(cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900">{t("movements")}</h3>
              <MovementForm />
              {movements.length === 0 ? (
                <p className="text-sm text-slate-500">{t("noMovements")}</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {movements.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span className="text-slate-600">
                        {t(`movementTypes.${m.movement_type as "in"}`)} · {m.reason}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-900">
                        {m.movement_type === "in" ? "+" : "−"}
                        {formatPrice(m.amount_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900">{t("closeTitle")}</h3>
              <p className="text-sm text-slate-500">{t("closeDescription")}</p>
              <CloseSessionForm expectedCash={snapshot?.expected_cash_cents ?? 0} />
            </Card>
          </div>

          {reports.length > 0 ? (
            <Card className="space-y-2">
              <h3 className="text-sm font-medium text-slate-900">{t("reports")}</h3>
              <ul className="text-sm">
                {reports.map((r) => (
                  <li key={r.id} className="flex justify-between py-1 text-slate-600">
                    <span>
                      {r.report_type.toUpperCase()} · {r.report_number}
                    </span>
                    <span>
                      {format.dateTime(new Date(r.created_at), {
                        timeStyle: "short",
                        dateStyle: "short",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}

      <Link href="/institut/caisse" className="text-sm text-slate-500 underline">
        ← {t("backToPos")}
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
