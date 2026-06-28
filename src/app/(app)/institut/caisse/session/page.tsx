import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import {
  computeSessionSnapshot,
  getOpenCashSession,
} from "@/lib/institut/pos-session";
import { PosSessionBanner } from "@/components/app-shell/pos-session-status";
import { formatPrice } from "@/lib/utils";
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

  if (!cashSession) {
    return (
      <div className="space-y-6 px-4 py-4 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <div>
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80">
                {t("closedBadge")}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{t("openTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("closedIntro")}</p>
            </div>

            <ol className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
              {[t("steps.count"), t("steps.declare"), t("steps.sell")].map((label, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
            <OpenSessionForm defaultFloat={settings.default_opening_float_cents} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm">
          <Link href="/institut/caisse" className="text-slate-600 hover:text-slate-900">
            ← {t("backToPos")}
          </Link>
          <Link
            href="/compte/institut/caisse"
            className="text-slate-500 underline hover:text-slate-700"
          >
            {t("settingsLink")}
          </Link>
        </div>
      </div>
    );
  }

  const bannerSession = snapshot
    ? {
        opened_at: cashSession.opened_at,
        sales_count: snapshot.sales_count,
        total_cents: snapshot.total_cents,
        expected_cash_cents: snapshot.expected_cash_cents,
      }
    : undefined;

  return (
    <div className="space-y-0">
      {bannerSession ? <PosSessionBanner session={bannerSession} variant="open" /> : null}

      <div className="space-y-5 px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {format.dateTime(new Date(cashSession.opened_at), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            {t("openingFloat")} {formatPrice(cashSession.opening_float_cents)}
            {snapshot ? (
              <>
                {" · "}
                {t("stats.partial")}: {snapshot.partial_count}
              </>
            ) : null}
          </p>
          <XReportButton />
        </div>

        {snapshot && Object.keys(snapshot.by_payment_method).length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-medium text-slate-900">{t("byPayment")}</h3>
            <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(snapshot.by_payment_method).map(([method, cents]) => (
                <li key={method} className="flex justify-between gap-4 text-slate-600">
                  <span>{t(`methods.${method as "cash"}`, { defaultValue: method })}</span>
                  <span className="tabular-nums">{formatPrice(cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <h3 className="text-sm font-medium text-slate-900">{t("movements")}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("movementsHint")}</p>
            </div>
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
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <h3 className="text-sm font-medium text-slate-900">{t("closeTitle")}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("closeDescription")}</p>
            </div>
            <CloseSessionForm expectedCash={snapshot?.expected_cash_cents ?? 0} />
          </div>
        </div>

        {reports.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-medium text-slate-900">{t("reports")}</h3>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
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
          </div>
        ) : null}

        <Link href="/institut/caisse" className="inline-block text-sm text-slate-500 hover:text-slate-700">
          ← {t("backToPos")}
        </Link>
      </div>
    </div>
  );
}
