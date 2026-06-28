"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

export function UserMenu({
  email,
  roleText,
  displayName,
  initial,
  align = "right",
  variant = "header",
}: {
  email: string | null;
  roleText: string;
  displayName: string;
  initial: string;
  align?: "left" | "right";
  variant?: "header" | "sidebar";
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50",
          variant === "sidebar" && "w-full",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
          {initial}
        </span>
        <span
          className={cn(
            "min-w-0",
            variant === "header" ? "hidden sm:block" : "flex-1",
          )}
        >
          <span
            className={cn(
              "block truncate text-sm font-medium text-slate-900",
              variant === "header" && "max-w-[9rem]",
            )}
          >
            {displayName}
          </span>
          <span
            className={cn(
              "block truncate text-xs text-slate-500",
              variant === "header" && "max-w-[9rem]",
            )}
          >
            {roleText}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
            {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
          </div>

          <div className="py-1">
            <Link
              href="/compte"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              role="menuitem"
            >
              {t("myAccount")}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
