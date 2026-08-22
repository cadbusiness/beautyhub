"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  id: string;
  label: string;
  hint?: string;
};

export function SearchSelect({
  value,
  options,
  onChange,
  placeholder,
  emptyLabel,
  noResultsLabel,
  ariaLabel,
  disabled = false,
  size = "md",
  className,
}: {
  value: string;
  options: SearchSelectOption[];
  onChange: (id: string) => void;
  placeholder: string;
  emptyLabel?: string;
  noResultsLabel: string;
  ariaLabel: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selected = options.find((option) => option.id === value) ?? null;
  const display = open ? query : (selected?.label ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const selectedLabel = (selected?.label ?? "").toLocaleLowerCase();
    if (!q || q === selectedLabel) return options;
    return options.filter((option) => {
      const hay = `${option.label} ${option.hint ?? ""}`.toLocaleLowerCase();
      return hay.includes(q);
    });
  }, [options, query, selected?.label]);

  const items = useMemo(() => {
    if (!emptyLabel) return filtered;
    return [{ id: "", label: emptyLabel }, ...filtered];
  }, [emptyLabel, filtered]);

  function placeMenu() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const below = window.innerHeight - rect.bottom - gap - 8;
    const above = rect.top - gap - 8;
    const openUp = below < 180 && above > below;
    const maxHeight = Math.max(160, Math.min(280, openUp ? above : below));
    setMenuBox({
      top: openUp ? rect.top - gap - maxHeight : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }

  useEffect(() => {
    if (!open) return;
    setQuery(selected?.label ?? "");
    setActiveIndex(emptyLabel ? 1 : 0);
    placeMenu();
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        const menu = document.getElementById(listId);
        if (menu?.contains(event.target as Node)) return;
        setOpen(false);
      }
    }
    function onReposition() {
      placeMenu();
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, emptyLabel, listId, selected?.label]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) pick(item.id);
    }
  }

  const compact = size === "sm";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex w-full items-center rounded-lg border bg-white outline-none",
          compact ? "h-8" : "h-10",
          disabled
            ? "border-slate-200 bg-slate-50"
            : open
              ? "border-ring ring-2 ring-ring/20"
              : "border-slate-300 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        )}
      >
        <Search
          className={cn(
            "ml-2.5 shrink-0 text-slate-400",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={display}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(emptyLabel ? 0 : 0);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-2 text-slate-900 outline-none placeholder:text-slate-400",
            compact ? "text-xs" : "text-sm",
          )}
        />
        {value && emptyLabel && !disabled ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={emptyLabel ?? placeholder}
            onClick={() => pick("")}
            className="shrink-0 p-1 text-slate-400 hover:text-slate-700"
          >
            <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
          className="shrink-0 px-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40"
        >
          <ChevronDown
            className={cn(
              "transition-transform",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
      {open && menuBox && typeof document !== "undefined"
        ? createPortal(
            <ul
              id={listId}
              role="listbox"
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
                maxHeight: menuBox.maxHeight,
              }}
              className="fixed z-50 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {items.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">{noResultsLabel}</li>
              ) : (
                items.map((option, index) => {
                  const active = option.id === value;
                  const highlighted = index === activeIndex;
                  return (
                    <li key={`${option.id || "empty"}-${index}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pick(option.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left",
                          compact ? "text-xs" : "text-sm",
                          highlighted
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {option.label}
                          {option.hint ? (
                            <span
                              className={cn(
                                "mt-0.5 block truncate text-[11px]",
                                highlighted ? "text-white/70" : "text-slate-400",
                              )}
                            >
                              {option.hint}
                            </span>
                          ) : null}
                        </span>
                        {active ? (
                          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
