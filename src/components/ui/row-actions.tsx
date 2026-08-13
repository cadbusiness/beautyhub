"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
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

/**
 * Menu kebab pour actions de ligne. Ouvre un popup au clic sur `⋮`,
 * ferme sur clic extérieur ou Escape. À placer dans un `<td>` avec
 * `onClick={(e) => e.stopPropagation()}` si la ligne parente est cliquable.
 */
export function RowActionsMenu({
  children,
  label,
  align = "right",
  disabled,
}: {
  children: ReactNode;
  /** aria-label du bouton kebab */
  label: string;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-30 mt-1 min-w-45 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function RowActionsMenuItem({
  children,
  icon,
  tone = "default",
  onSelect,
  disabled,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: RowActionTone;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onSelect();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
        tone === "default" && "text-slate-700 hover:bg-slate-100",
        tone === "danger" && "text-red-600 hover:bg-red-50",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {icon ? <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="flex-1">{children}</span>
    </button>
  );
}
