"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180", className)}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function UserMenu({
  email,
  roleText,
  displayName,
  initial,
  align = "right",
  variant = "header",
  hideAccountLink = false,
}: {
  email: string | null;
  roleText: string;
  displayName: string;
  initial: string;
  align?: "left" | "right";
  variant?: "header" | "sidebar";
  hideAccountLink?: boolean;
}) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dropdownUp = variant === "sidebar";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center rounded-lg border border-slate-200 bg-white text-left transition-colors hover:border-slate-300 hover:bg-slate-50",
          variant === "header" && "h-9 w-9 shrink-0 justify-center sm:w-auto sm:justify-start sm:gap-1.5 sm:pl-1 sm:pr-2",
          variant === "sidebar" && "w-full gap-2 py-1 pl-1 pr-2.5",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md bg-slate-900 font-semibold text-white",
            variant === "header" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-sm",
          )}
        >
          {initial}
        </span>
        <span
          className={cn(
            "min-w-0 leading-none",
            variant === "header" ? "hidden sm:block" : "flex-1",
          )}
        >
          <span
            className={cn(
              "block truncate font-medium text-slate-900",
              variant === "header" ? "max-w-[7rem] text-xs" : "text-sm",
            )}
          >
            {displayName}
          </span>
          <span
            className={cn(
              "block truncate text-slate-500",
              variant === "header" ? "mt-0.5 max-w-[7rem] text-[11px]" : "text-xs",
            )}
          >
            {roleText}
          </span>
        </span>
        <ChevronIcon
          open={open}
          className={cn(variant === "header" && "hidden sm:block")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
            dropdownUp ? "bottom-full mb-2" : "mt-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
            {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
          </div>

          <div className="py-1">
            {!hideAccountLink ? (
              <Link
                href="/compte"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                role="menuitem"
              >
                {t("myAccount")}
              </Link>
            ) : null}
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              role="menuitem"
              onClick={() => void signOut()}
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
