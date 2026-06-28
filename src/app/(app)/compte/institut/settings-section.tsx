import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  status,
  statusTone = "neutral",
  children,
  footer,
}: {
  title: string;
  description: string;
  status?: string;
  statusTone?: "success" | "neutral";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="w-full space-y-5 p-5 shadow-none sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-medium text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {status ? (
          <span
            className={cn(
              "inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              statusTone === "success"
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-600",
            )}
          >
            {status}
          </span>
        ) : null}
      </div>
      {children}
      {footer}
    </Card>
  );
}
