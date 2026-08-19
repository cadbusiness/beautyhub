import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

export function Input({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"input">) {
  return <input ref={ref} className={cn(base, className)} {...props} />;
}

export function Select({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"select">) {
  return <select ref={ref} className={cn(base, className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      ref={ref}
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
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
