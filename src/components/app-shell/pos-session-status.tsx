"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

export type PosSessionStatusData = {
  opened_at: string;
  sales_count: number;
  total_cents: number;
  expected_cash_cents: number;
};

function formatDuration(
  openedAt: string,
  t: (key: "durationJustOpened" | "durationMins" | "durationHours", values?: Record<string, number>) => string,
): string {
  const ms = Math.max(0, Date.now() - new Date(openedAt).getTime());
  const totalMins = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return t("durationHours", { hours, mins });
  if (mins > 0) return t("durationMins", { mins });
  return t("durationJustOpened");
}

export function PosSessionDuration({
  openedAt,
  className,
}: {
  openedAt: string;
  className?: string;
}) {
  const t = useTranslations("shell.posSession");
  const [duration, setDuration] = useState(() => formatDuration(openedAt, t));

  useEffect(() => {
    setDuration(formatDuration(openedAt, t));
    const id = setInterval(() => setDuration(formatDuration(openedAt, t)), 60_000);
    return () => clearInterval(id);
  }, [openedAt, t]);

  return <span className={className}>{duration}</span>;
}

/** Badge compact pour le header. */
export function PosSessionHeaderBadge({
  session,
}: {
  session: PosSessionStatusData;
}) {
  const t = useTranslations("shell.posSession");

  return (
    <Link
      href="/institut/caisse/session"
      className="hidden items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-900 transition-colors hover:bg-green-100 md:inline-flex"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <span>{t("open")}</span>
      <span className="text-green-700">·</span>
      <PosSessionDuration openedAt={session.opened_at} className="tabular-nums text-green-800" />
    </Link>
  );
}

/** Bandeau accueil / page session. */
export function PosSessionBanner({
  session,
  variant = "open",
}: {
  session?: PosSessionStatusData;
  variant: "open" | "closed";
}) {
  const t = useTranslations("dashboard.posSession");

  if (variant === "closed") {
    return (
      <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <p className="text-sm font-medium text-amber-950">{t("closedTitle")}</p>
          <p className="mt-0.5 text-sm text-amber-900/80">{t("closedDescription")}</p>
        </div>
        <Link
          href="/institut/caisse/session"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-4 text-sm font-medium text-white hover:bg-amber-950"
        >
          {t("openSession")}
        </Link>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="border-b border-green-200 bg-green-50/70 px-4 py-4 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900 ring-1 ring-green-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
              {t("openTitle")}
            </span>
            <span className="text-sm text-green-800">
              {t("openSince")}{" "}
              <PosSessionDuration openedAt={session.opened_at} className="font-medium tabular-nums" />
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-lg">
            <BannerStat label={t("sales")} value={String(session.sales_count)} />
            <BannerStat label={t("revenue")} value={formatPrice(session.total_cents)} />
            <BannerStat label={t("expectedCash")} value={formatPrice(session.expected_cash_cents)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/institut/caisse"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t("goToPos")}
          </Link>
          <Link
            href="/institut/caisse/session"
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg border border-green-300 bg-white px-4 text-sm font-medium text-green-900 hover:bg-green-50",
            )}
          >
            {t("manageSession")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function BannerStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-green-800/70">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-green-950">{value}</p>
    </div>
  );
}
