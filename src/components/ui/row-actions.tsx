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
  return (
    <div className={cn("flex flex-nowrap items-center justify-end gap-0.5", className)}>
      {children}
    </div>
  );
}

export function RowActionButton({
  children,
  icon,
  tone = "default",
  iconOnly = false,
  className,
  ...props
}: Omit<ButtonProps, "variant"> & {
  children: ReactNode;
  icon?: ReactNode;
  tone?: RowActionTone;
  /** Icône seule — le libellé sert d’aria-label / title */
  iconOnly?: boolean;
}) {
  const label = typeof children === "string" ? children : undefined;

  return (
    <Button
      variant="ghost"
      className={cn(
        iconOnly ? "h-8 w-8 shrink-0 p-0" : "h-8 gap-1.5 px-2.5 text-sm font-medium",
        tone === "default" && "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        tone === "danger" && "text-red-600 hover:bg-red-50 hover:text-red-700",
        className,
      )}
      title={iconOnly ? label : props.title}
      {...props}
      aria-label={iconOnly ? (label ?? props["aria-label"]) : props["aria-label"]}
    >
      {icon}
      {iconOnly ? null : children}
    </Button>
  );
}
