import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ListToolbar } from "@/components/ui/list-toolbar";
import type { HistoryPeriod } from "@/lib/date";

type Chip = { value: string; label: string };

function buildHref(
  pathname: string,
  current: Record<string, string>,
  patch: Record<string, string>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (!value) continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex h-7 items-center rounded-full bg-slate-900 px-2.5 text-xs font-medium text-white"
          : "inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
      }
    >
      {children}
    </Link>
  );
}

export function HistoryFilterBar({
  pathname,
  period,
  status,
  type,
  q,
  periodOptions,
  statusOptions,
  typeOptions,
  searchPlaceholder,
  searchName = "q",
}: {
  pathname: string;
  period: HistoryPeriod;
  status?: string;
  type?: string;
  q?: string;
  periodOptions: Chip[];
  statusOptions?: Chip[];
  typeOptions?: Chip[];
  searchPlaceholder: string;
  searchName?: string;
}) {
  const current: Record<string, string> = {
    period,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(q ? { q } : {}),
  };

  return (
    <ListToolbar>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {periodOptions.map((opt) => (
            <FilterChip
              key={opt.value}
              href={buildHref(pathname, current, { period: opt.value })}
              active={period === opt.value}
            >
              {opt.label}
            </FilterChip>
          ))}
          {statusOptions?.map((opt) => (
            <FilterChip
              key={`st-${opt.value}`}
              href={buildHref(pathname, current, { status: opt.value })}
              active={(status ?? "all") === opt.value}
            >
              {opt.label}
            </FilterChip>
          ))}
          {typeOptions?.map((opt) => (
            <FilterChip
              key={`ty-${opt.value}`}
              href={buildHref(pathname, current, { type: opt.value })}
              active={(type ?? "all") === opt.value}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
        <form method="get" className="sm:max-w-xs">
          <input type="hidden" name="period" value={period} />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {type ? <input type="hidden" name="type" value={type} /> : null}
          <Input
            type="search"
            name={searchName}
            defaultValue={q}
            placeholder={searchPlaceholder}
            className="h-8"
          />
        </form>
      </div>
    </ListToolbar>
  );
}
