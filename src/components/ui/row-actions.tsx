import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionTone = "default" | "danger";

export function RowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap justify-end gap-1", className)}>{children}</div>;
}

export function RowActionButton({
  children,
  icon,
  tone = "default",
  className,
  ...props
}: Omit<ButtonProps, "variant"> & {
  children: ReactNode;
  icon?: ReactNode;
  tone?: RowActionTone;
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-8 gap-1.5 px-2.5 text-sm font-medium",
        tone === "default" && "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        tone === "danger" && "text-red-600 hover:bg-red-50 hover:text-red-700",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}
