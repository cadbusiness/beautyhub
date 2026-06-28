"use client";

import { useCallback, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageTabs } from "@/components/ui/page-tabs";
import { cn, formatPrice } from "@/lib/utils";
import type {
  DashboardPeriod,
  DashboardSnapshot,
  HealthMood,
} from "@/lib/institut/dashboard-stats";

const PERIODS: DashboardPeriod[] = ["today", "week", "month", "year"];

const MOOD_STYLES: Record<
  HealthMood,
  { gradient: string; ring: string; emoji: string }
> = {
  great: {
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    ring: "stroke-emerald-200",
    emoji: "🚀",
  },
  good: {
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    ring: "stroke-violet-200",
    emoji: "✨",
  },
  ok: {
    gradient: "from-amber-400 via-orange-400 to-rose-400",
    ring: "stroke-amber-200",
    emoji: "💪",
  },
  low: {
    gradient: "from-slate-400 via-slate-500 to-slate-600",
    ring: "stroke-slate-200",
    emoji: "🌱",
  },
};

function ChangeBadge({
  value,
  variant = "light",
}: {
  value: number | null;
  variant?: "light" | "dark";
}) {
  const t = useTranslations("dashboard.analytics");
  if (value === null) {
    return (
      <span
        className={cn(
          "text-xs",
          variant === "dark" ? "text-white/70" : "text-slate-400",
        )}
      >
        {t("noComparison")}
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "dark"
          ? positive
            ? "bg-white/20 text-white"
            : "bg-black/15 text-white/90"
          : positive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-rose-50 text-rose-700",
      )}
    >
      {positive ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

function HealthRing({ score, mood }: { score: number; mood: HealthMood }) {
  const style = MOOD_STYLES[mood];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className={cn("stroke-white/25", style.ring)}
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-xl leading-none">{style.emoji}</span>
        <span className="mt-0.5 text-lg font-bold tabular-nums">{score}</span>
      </div>
    </div>
  );
}

function BarChart({
  data,
  formatValue,
  colorClass,
  emptyLabel,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  colorClass: string;
  emptyLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-44 items-end gap-1 sm:gap-1.5">
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
                className={cn(
                  "w-full rounded-t-md transition-all duration-500 group-hover:opacity-90",
                  colorClass,
                )}
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
  if (total === 0) {
    return null;
  }

  const segments = [
    { value: completed, color: "bg-emerald-500", label: labels.completed },
    { value: scheduled, color: "bg-sky-500", label: labels.scheduled },
    { value: cancelled, color: "bg-rose-400", label: labels.cancelled },
    { value: noShow, color: "bg-amber-400", label: labels.noShow },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-full transition-all duration-500", seg.color)}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", seg.color)} />
            <span className="truncate text-slate-600">{seg.label}</span>
            <span className="ml-auto tabular-nums font-semibold text-slate-900">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/75">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
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

  const loadPeriod = useCallback(
    (next: DashboardPeriod) => {
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
    },
    [],
  );

  const { today, analytics } = snapshot;
  const moodStyle = MOOD_STYLES[today.mood];
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
    <div className={cn("space-y-4", isPending && "opacity-70 transition-opacity")}>
      {/* Santé du jour — hero */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-sm sm:p-6",
          moodStyle.gradient,
        )}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <HealthRing score={today.healthScore} mood={today.mood} />
            <div>
              <p className="text-sm font-medium text-white/80">{t("healthTitle")}</p>
              <p className="mt-1 text-xl font-semibold sm:text-2xl">
                {t(`mood.${today.mood}`)}
              </p>
              <p className="mt-2 max-w-sm text-sm text-white/85">{t("healthHint")}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-medium text-white/80">{t("todayRevenue")}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
              {formatPrice(today.revenueCents, "eur", locale)}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {t("todaySales", { count: today.salesCount })}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <HeroStat label={t("todayAppointments")} value={today.appointmentsScheduled} />
          <HeroStat label={t("todayCompleted")} value={today.appointmentsCompleted} />
          <HeroStat label={t("todayCancelled")} value={today.appointmentsCancelled} />
          <HeroStat label={t("todayNewClients")} value={today.newClients} />
        </div>
      </div>

      {/* Sélecteur de période */}
      <PageTabs
        tabs={periodTabs}
        active={period}
        onChange={loadPeriod}
        className="-mx-4 rounded-t-xl border border-b-0 border-slate-200 bg-white lg:-mx-6"
      />

      {/* KPIs période */}
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-4 lg:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("periodOverview")}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{t(`periodHint.${period}`)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
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
            <h4 className="mb-3 text-sm font-medium text-slate-900">{t("revenueChart")}</h4>
            <BarChart
              data={revenueChartData}
              formatValue={(v) => formatPrice(v, "eur", locale)}
              colorClass="bg-gradient-to-t from-violet-600 to-violet-400"
              emptyLabel={t("emptyChart")}
            />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium text-slate-900">
              {t("appointmentsChart")}
            </h4>
            <BarChart
              data={appointmentsChartData}
              formatValue={(v) => String(v)}
              colorClass="bg-gradient-to-t from-sky-600 to-sky-400"
              emptyLabel={t("emptyChart")}
            />
          </div>
        </div>

        <div className="mt-6">
          <h4 className="mb-3 text-sm font-medium text-slate-900">{t("appointmentMix")}</h4>
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
            <p className="text-sm text-slate-400">{t("emptyAppointments")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
