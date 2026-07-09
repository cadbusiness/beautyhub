"use client";

export function PrintVoucherButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 print:hidden"
    >
      {label}
    </button>
  );
}
