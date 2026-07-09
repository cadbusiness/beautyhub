"use client";

import { useTranslations } from "next-intl";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { cn } from "@/lib/utils";
import type { CalendarColumn } from "./types";

export function StaffFilterRow({
  staff,
  selectedStaffId,
  onSelect,
}: {
  staff: CalendarColumn[];
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
}) {
  const t = useTranslations("common");

  if (staff.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3 lg:px-6">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors",
          selectedStaffId === null
            ? "bg-slate-900 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          *
        </span>
        {t("all")}
      </button>
      {staff.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={cn(
            "flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors",
            selectedStaffId === s.id
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <StaffAvatar name={s.label} color={s.color} />
          <span className="max-w-24 truncate">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
