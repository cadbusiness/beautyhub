import { cn } from "@/lib/utils";

export function DataTable({
  empty,
  children,
  className,
}: {
  empty?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (empty) {
    return <p className="px-4 py-12 text-sm text-slate-500 lg:px-6">{empty}</p>;
  }

  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

export const dataTableCell = "px-4 py-3 lg:px-6";
export const dataTableHead =
  "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:px-6";

export const dataTableRow =
  "border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/70";
