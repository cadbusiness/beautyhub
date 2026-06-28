"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function PaginationBar({
  page,
  totalPages,
  from,
  to,
  total,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const t = useTranslations("common.pagination");

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500",
        className,
      )}
    >
      <span>{t("showing", { from, to, total })}</span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded px-2 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <span className="tabular-nums text-slate-400">
            {t("pageOf", { page, totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded px-2 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
