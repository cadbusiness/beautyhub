import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(base, "h-auto min-h-20 py-2", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
