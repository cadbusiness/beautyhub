import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MarketingToolCard({
  href,
  title,
  description,
  status,
  statusTone = "neutral",
  disabled = false,
}: {
  href?: string;
  title: string;
  description: string;
  status?: string;
  statusTone?: "success" | "neutral" | "warning";
  disabled?: boolean;
}) {
  const content = (
    <Card
      className={cn(
        "h-full p-5 shadow-none transition-colors",
        disabled
          ? "opacity-70"
          : href
            ? "hover:border-slate-300 hover:bg-slate-50/50"
            : undefined,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {status ? (
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              statusTone === "success" && "bg-green-100 text-green-700",
              statusTone === "warning" && "bg-amber-100 text-amber-800",
              statusTone === "neutral" && "bg-slate-100 text-slate-600",
            )}
          >
            {status}
          </span>
        ) : null}
      </div>
    </Card>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className="group block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
