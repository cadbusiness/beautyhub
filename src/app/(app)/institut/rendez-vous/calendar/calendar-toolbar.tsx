"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CalendarOption, CalendarViewMode, ColumnMode } from "./types";

const VIEW_TABS: CalendarViewMode[] = ["month", "week", "day"];

export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  columnMode,
  onColumnModeChange,
  anchor,
  onAnchorChange,
  onToday,
  onRefresh,
  serviceFilter,
  onServiceFilterChange,
  staffFilter,
  onStaffFilterChange,
  services,
  staff,
  refreshing,
}: {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  columnMode: ColumnMode;
  onColumnModeChange: (mode: ColumnMode) => void;
  anchor: Date;
  onAnchorChange: (delta: number) => void;
  onToday: () => void;
  onRefresh: () => void;
  serviceFilter: string;
  onServiceFilterChange: (id: string) => void;
  staffFilter: string;
  onStaffFilterChange: (id: string) => void;
  services: CalendarOption[];
  staff: CalendarOption[];
  refreshing?: boolean;
}) {
  const t = useTranslations("appointments.calendar");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const dateLabel =
    viewMode === "month"
      ? format.dateTime(anchor, { month: "long", year: "numeric" })
      : viewMode === "week"
        ? t("weekOf", {
            date: format.dateTime(anchor, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })
        : format.dateTime(anchor, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });

  const navStep = viewMode === "month" ? 30 : viewMode === "week" ? 7 : 1;

  return (
    <div className="space-y-0 border-b border-slate-200">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <Select
          value={serviceFilter}
          onChange={(e) => onServiceFilterChange(e.target.value)}
          className="h-9 w-full max-w-[200px]"
        >
          <option value="">{t("allServices")}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select
          value={staffFilter}
          onChange={(e) => onStaffFilterChange(e.target.value)}
          className="h-9 w-full max-w-[200px]"
        >
          <option value="">{t("allStaff")}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={tCommon("refresh")}
          >
            ↻
          </Button>
          <Link href="/reserver" target="_blank">
            <Button variant="outline" className="h-9">
              {t("publicPage")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 lg:px-6">
        <nav className="flex gap-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onViewModeChange(tab)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                viewMode === tab
                  ? "border-slate-900 font-medium text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t(`views.${tab}`)}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "day" ? (
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => onColumnModeChange("staff")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  columnMode === "staff" ? "bg-slate-900 text-white" : "text-slate-600",
                )}
              >
                {t("columnMode.staff")}
              </button>
              <button
                type="button"
                onClick={() => onColumnModeChange("resource")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  columnMode === "resource" ? "bg-slate-900 text-white" : "text-slate-600",
                )}
              >
                {t("columnMode.resource")}
              </button>
            </div>
          ) : null}
          <Button type="button" variant="outline" className="h-8 px-2" onClick={() => onAnchorChange(-navStep)}>
            ←
          </Button>
          <Button type="button" variant="outline" className="h-8" onClick={onToday}>
            {t("today")}
          </Button>
          <span className="min-w-48 text-center text-sm text-slate-600">{dateLabel}</span>
          <Button type="button" variant="outline" className="h-8 px-2" onClick={() => onAnchorChange(navStep)}>
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
