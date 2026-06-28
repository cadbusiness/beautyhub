import { Card } from "@/components/ui/card";
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
  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      {empty ? (
        <p className="p-6 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </Card>
  );
}

export const dataTableCell = "px-4 py-3";
export const dataTableHead = "px-4 py-3 font-medium";
