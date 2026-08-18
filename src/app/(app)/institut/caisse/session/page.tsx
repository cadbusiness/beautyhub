import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { isPreviousCalendarDay, toDateTimeLocalValue } from "@/lib/date";
import { getPosSettings } from "@/lib/institut/pos-settings";
import {
  computeSessionSnapshot,
  getOpenCashSession,
  suggestedSessionClosedAt,
} from "@/lib/institut/pos-session";
import { formatPrice } from "@/lib/utils";
import { OpenSessionForm } from "./open-session-form";
import { MovementForm } from "./movement-form";
import { CloseSessionForm } from "./close-session-form";
import { XReportButton } from "./x-report-button";
import { PauseResumeButton } from "./pause-resume-button";

export default async function CaisseSessionPage() {
  const t = await getTranslations("pos.session");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const cashSession = await getOpenCashSession(supabase, tenantId);

  const [settings, movementsRes, reportsRes, lastSaleRes] = await Promise.all([
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
    cashSession
      ? supabase
          .from("inst_sales")
          .select("created_at")
          .eq("tenant_id", tenantId)
          .eq("cash_session_id", cashSession.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { created_at: string } | null }),
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
              <p className="mt-3 text-sm text-slate-500">{t("guide")}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
            <OpenSessionForm
              defaultFloat={settings.default_opening_float_cents}
              currency={settings.currency}
            />
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

  const breakdown = snapshot
    ? {
        openingFloatCents: cashSession.opening_float_cents,
        cashSalesCents: snapshot.by_payment_method.cash ?? 0,
        movementsInCents: snapshot.movements_in_cents,
        movementsOutCents: snapshot.movements_out_cents,
        movementsExpenseCents: snapshot.movements_expense_cents,
        expectedCashCents: snapshot.expected_cash_cents,
      }
    : null;

  const workflowSteps = [
    { n: 1, title: t("workflow.journal"), done: true },
    { n: 2, title: t("workflow.xReport"), done: reports.some((r) => r.report_type === "x") },
    { n: 3, title: t("workflow.zClose"), done: false },
  ];
  const previousDay = isPreviousCalendarDay(cashSession.opened_at);

  return (
    <div className="space-y-5 px-4 py-4 lg:px-6">
      {previousDay ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber-950">{t("previousDayTitle")}</p>
            <p className="mt-0.5 text-sm text-amber-900/80">{t("previousDayBody")}</p>
          </div>
          <p className="shrink-0 text-xs font-medium text-amber-800">{t("previousDayHint")}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                cashSession.status === "paused"
                  ? "inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950"
                  : previousDay
                    ? "inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950"
                    : "inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900"
              }
            >
              <span
                className={
                  cashSession.status === "paused" || previousDay
                    ? "h-1.5 w-1.5 rounded-full bg-amber-500"
                    : "h-1.5 w-1.5 rounded-full bg-green-500"
                }
                aria-hidden
              />
              {cashSession.status === "paused"
                ? t("sessionPaused")
                : previousDay
                  ? t("previousDayBadge")
                  : t("sessionOpen")}
            </span>
            <span className="text-xs text-slate-500">
              {format.dateTime(new Date(cashSession.opened_at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {cashSession.status === "paused"
              ? t("pauseHint")
              : previousDay
                ? t("previousDayWorkflow")
                : t("workflowIntro")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PauseResumeButton paused={cashSession.status === "paused"} />
          {cashSession.status === "paused" ? null : (
            <Link href="/institut/caisse">
              <span className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
                {t("goToPos")}
              </span>
            </Link>
          )}
        </div>
      </div>

      <nav aria-label={t("workflowAria")} className="grid gap-2 sm:grid-cols-3">
        {workflowSteps.map((step) => (
          <div
            key={step.n}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
          >
            <span
              className={
                step.done
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white"
                  : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
              }
            >
              {step.n}
            </span>
            <span className="text-sm font-medium text-slate-800">{step.title}</span>
          </div>
        ))}
      </nav>

      {snapshot && Object.keys(snapshot.by_payment_method).length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-medium text-slate-900">{t("byPayment")}</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(snapshot.by_payment_method).map(([method, cents]) => (
              <li key={method} className="flex justify-between gap-4 text-slate-600">
                <span>{t(`methods.${method as "cash"}`, { defaultValue: method })}</span>
                <span className="tabular-nums font-medium text-slate-900">
                  {formatPrice(cents, settings.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="space-y-4 xl:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("workflow.journal")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">{t("movementsHint")}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {cashSession.status === "paused" ? (
              <p className="text-sm text-slate-600">{t("pauseHint")}</p>
            ) : (
              <MovementForm />
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("journalTitle")}
            </h4>
            {movements.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noMovements")}</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {movements.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {t(`movementTypes.${m.movement_type as "in"}`)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{m.reason}</p>
                      <p className="text-xs text-slate-400">
                        {format.dateTime(new Date(m.created_at), {
                          timeStyle: "short",
                          dateStyle: "short",
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium text-slate-900">
                      {m.movement_type === "in" ? "+" : "−"}
                      {formatPrice(m.amount_cents, settings.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-4 xl:col-span-3">
          <XReportButton />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">{t("closeTitle")}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("closeDescription")}</p>
            </div>
            {breakdown ? (
              <CloseSessionForm
                breakdown={breakdown}
                currency={settings.currency}
                suggestedClosedAt={toDateTimeLocalValue(
                  suggestedSessionClosedAt({
                    openedAt: cashSession.opened_at,
                    lastSaleAt: lastSaleRes.data?.created_at ?? null,
                  }),
                )}
                previousDay={previousDay}
              />
            ) : null}
          </div>
        </section>
      </div>

      {reports.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-medium text-slate-900">{t("reports")}</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 py-1 text-slate-600">
                <span>
                  {r.report_type.toUpperCase()} · {r.report_number}
                </span>
                <span className="shrink-0 tabular-nums">
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
  );
}
