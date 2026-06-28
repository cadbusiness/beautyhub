"use client";

import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/ui/pagination";

/** Pleine largeur du contenu principal — bord à bord, sans carte inset. */
export function ListPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 flex min-h-0 flex-1 flex-col bg-white lg:-mx-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListPanelFooter({
  children,
  pagination,
  className,
}: {
  children: React.ReactNode;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-auto flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-400 lg:px-6",
        className,
      )}
    >
      <span>{children}</span>
      {pagination ? (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
        />
      ) : null}
    </div>
  );
}
