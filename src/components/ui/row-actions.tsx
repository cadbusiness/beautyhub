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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_WIDTH = 200;

  function computePosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left =
      align === "right"
        ? Math.max(8, rect.right - MENU_WIDTH)
        : Math.min(window.innerWidth - MENU_WIDTH - 8, rect.left);
    setPos({ top: rect.bottom + 4, left });
  }

  useEffect(() => {
    if (!open) return;
    computePosition();
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReflow() {
      computePosition();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
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
      {open && pos ? (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </>
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
