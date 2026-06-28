"use client";

import { useCallback, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageTabs } from "@/components/ui/page-tabs";
import { cn, formatPrice } from "@/lib/utils";
import type { DashboardPeriod, DashboardSnapshot } from "@/lib/institut/dashboard-stats";

const PERIODS: DashboardPeriod[] = ["today", "week", "month", "year"];

function ChangeBadge({ value }: { value: number | null }) {
  const t = useTranslations("dashboard.analytics");
  if (value === null) {
    return <span className="text-xs text-slate-400">{t("noComparison")}</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        positive ? "text-green-700" : "text-rose-600",
      )}
    >
      {positive ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 lg:px-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
        {value}
      </p>
      {hint ? <div className="mt-1">{hint}</div> : null}
    </div>
  );
}

function BarChart({
  data,
  formatValue,
  emptyLabel,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  emptyLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-40 items-end gap-1 border border-slate-200 bg-white px-2 pb-2 pt-6 sm:gap-1.5 sm:px-3">
      {data.map((point) => {
        const heightPct = Math.max(4, (point.value / max) * 100);
        return (
          <div
            key={point.label}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span className="pointer-events-none rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {formatValue(point.value)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full bg-slate-800 transition-opacity group-hover:bg-slate-700"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] text-slate-500 sm:text-xs">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AppointmentMixChart({
  completed,
  cancelled,
  noShow,
  scheduled,
  labels,
}: {
  completed: number;
  cancelled: number;
  noShow: number;
  scheduled: number;
  labels: { completed: string; cancelled: string; noShow: string; scheduled: string };
}) {
  const total = completed + cancelled + noShow + scheduled;
  if (total === 0) return null;

  const segments = [
    { value: completed, color: "bg-slate-800", label: labels.completed },
    { value: scheduled, color: "bg-slate-400", label: labels.scheduled },
    { value: cancelled, color: "bg-slate-300", label: labels.cancelled },
    { value: noShow, color: "bg-slate-500", label: labels.noShow },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-3 border border-slate-200 bg-white p-4">
      <div className="flex h-2 overflow-hidden bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-full", seg.color)}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", seg.color)} />
            <span className="truncate text-slate-600">{seg.label}</span>
            <span className="ml-auto tabular-nums font-medium text-slate-900">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardAnalytics({
  initialSnapshot,
}: {
  initialSnapshot: DashboardSnapshot;
}) {
  const t = useTranslations("dashboard.analytics");
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [period, setPeriod] = useState<DashboardPeriod>(initialSnapshot.analytics.period);
  const [isPending, startTransition] = useTransition();

  const loadPeriod = useCallback((next: DashboardPeriod) => {
    setPeriod(next);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/institut/dashboard-stats?period=${next}`);
        if (!res.ok) return;
        const data = (await res.json()) as DashboardSnapshot;
        setSnapshot(data);
      } catch {
        /* keep previous data */
      }
    });
  }, []);

  const { today, analytics } = snapshot;
  const scheduledInPeriod =
    analytics.appointmentsTotal -
    analytics.appointmentsCancelled -
    analytics.appointmentsCompleted -
    analytics.appointmentsNoShow;

  const periodTabs = PERIODS.map((p) => ({
    id: p,
    label: t(`periods.${p}`),
  }));

  const revenueChartData = analytics.series.map((point) => ({
    label: point.label,
    value: point.revenueCents,
  }));

  const appointmentsChartData = analytics.series.map((point) => ({
    label: point.label,
    value: point.appointments,
  }));

  return (
    <div className={cn("space-y-6", isPending && "opacity-60 transition-opacity")}>
      {/* Chiffres du jour — même pattern que les KPI d'origine */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 lg:px-5">
          <p className="text-sm font-medium text-slate-900">{t("healthTitle")}</p>
          <p className="mt-0.5 text-sm text-slate-500">{t("healthHint")}</p>
        </div>
        <div className="grid divide-y divide-slate-200 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <StatCell
            label={t("todayRevenue")}
            value={formatPrice(today.revenueCents, "eur", locale)}
            hint={
              <p className="text-xs text-slate-500">
                {t("todaySales", { count: today.salesCount })}
              </p>
            }
          />
          <StatCell
            label={t("healthScore")}
            value={today.healthScore}
            hint={
              <p className="text-xs text-slate-500">{t(`mood.${today.mood}`)}</p>
            }
          />
          <StatCell label={t("todayAppointments")} value={today.appointmentsScheduled} />
          <StatCell label={t("todayCompleted")} value={today.appointmentsCompleted} />
          <StatCell label={t("todayCancelled")} value={today.appointmentsCancelled} />
        </div>
      </div>

      {/* Période */}
      <div>
        <PageTabs
          tabs={periodTabs}
          active={period}
          onChange={loadPeriod}
          className="-mx-4 px-4 lg:-mx-6 lg:px-6"
        />

        <p className="mt-4 text-sm text-slate-500">{t(`periodHint.${period}`)}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("revenue")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
              {formatPrice(analytics.revenueCents, "eur", locale)}
            </p>
            <div className="mt-2">
              <ChangeBadge value={analytics.revenueChangePct} />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("sales")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
              {analytics.salesCount}
            </p>
            <div className="mt-2">
              <ChangeBadge value={analytics.salesChangePct} />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("appointments")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
              {analytics.appointmentsTotal}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {t("cancellationRate", { rate: analytics.cancellationRate })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("newClients")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
              {analytics.newClients}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {t("noShowCount", { count: analytics.appointmentsNoShow })}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-medium text-slate-900">{t("revenueChart")}</h4>
            <BarChart
              data={revenueChartData}
              formatValue={(v) => formatPrice(v, "eur", locale)}
              emptyLabel={t("emptyChart")}
            />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-slate-900">
              {t("appointmentsChart")}
            </h4>
            <BarChart
              data={appointmentsChartData}
              formatValue={(v) => String(v)}
              emptyLabel={t("emptyChart")}
            />
          </div>
        </div>

        <div className="mt-6">
          <h4 className="mb-2 text-sm font-medium text-slate-900">{t("appointmentMix")}</h4>
          <AppointmentMixChart
            completed={analytics.appointmentsCompleted}
            cancelled={analytics.appointmentsCancelled}
            noShow={analytics.appointmentsNoShow}
            scheduled={Math.max(0, scheduledInPeriod)}
            labels={{
              completed: t("status.completed"),
              cancelled: t("status.cancelled"),
              noShow: t("status.noShow"),
              scheduled: t("status.scheduled"),
            }}
          />
          {analytics.appointmentsTotal === 0 ? (
            <p className="mt-2 text-sm text-slate-400">{t("emptyAppointments")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
