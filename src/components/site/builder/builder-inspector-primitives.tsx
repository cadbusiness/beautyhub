"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const compactInput =
  "h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200";

export function InspectorSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50/80"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <span className={cn("text-[10px] text-slate-400 transition", open && "rotate-180")}>▾</span>
      </button>
      {open ? <div className="space-y-2 px-3 pb-3">{children}</div> : null}
    </section>
  );
}

export function InspectorRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="text-[11px] leading-tight text-slate-600">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function InspectorSlider({
  id,
  value,
  min,
  max,
  onChange,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-slate-800"
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(compactInput, "w-12 shrink-0 px-1 text-center tabular-nums")}
      />
    </div>
  );
}

export function InspectorColor({
  id,
  value,
  placeholder = "#ffffff",
  clearLabel,
  onChange,
  onClear,
}: {
  id?: string;
  value: string | null;
  placeholder?: string;
  clearLabel: string;
  onChange: (value: string | null) => void;
  onClear: () => void;
}) {
  const swatch = value ?? placeholder;

  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="color"
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
      />
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        placeholder={placeholder}
        className={cn(compactInput, "min-w-0 flex-1 font-mono text-[11px]")}
      />
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        title={clearLabel}
      >
        ×
      </button>
    </div>
  );
}

export function InspectorSelect({
  id,
  value,
  onChange,
  children,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={compactInput}>
      {children}
    </select>
  );
}

export function InspectorSegments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded border px-2 py-1 text-[10px] font-medium transition",
            value === opt.value
              ? "border-slate-800 bg-slate-800 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function InspectorTextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  id?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
}) {
  return (
    <input
      id={id}
      type={type}
      min={min}
      max={max}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={compactInput}
    />
  );
}

export function InspectorTextarea({
  id,
  value,
  onChange,
  rows = 2,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(compactInput, "h-auto resize-none py-1.5")}
    />
  );
}

export function InspectorCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-[11px] text-slate-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300"
      />
      {label}
    </label>
  );
}
