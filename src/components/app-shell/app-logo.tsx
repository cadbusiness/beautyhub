import Link from "next/link";

export function AppLogo() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
        B
      </span>
      <span className="hidden text-base font-semibold text-slate-900 sm:inline">
        BeautyHub
      </span>
    </Link>
  );
}
