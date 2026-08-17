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
    if ((key === "status" || key === "type") && value === "all") continue;
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
      scroll={false}
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

function ChipRow({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {label ? (
        <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
      ) : null}
      {children}
    </div>
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
  statusLabel,
  typeLabel,
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
  statusLabel?: string;
  typeLabel?: string;
  searchPlaceholder: string;
  searchName?: string;
}) {
  const current: Record<string, string> = {
    period,
    ...(status && status !== "all" ? { status } : {}),
    ...(type && type !== "all" ? { type } : {}),
    ...(q ? { q } : {}),
  };

  return (
    <ListToolbar>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <ChipRow>
          {periodOptions.map((opt) => (
            <FilterChip
              key={opt.value}
              href={buildHref(pathname, current, { period: opt.value })}
              active={period === opt.value}
            >
              {opt.label}
            </FilterChip>
          ))}
        </ChipRow>
        {statusOptions || typeOptions ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
            {statusOptions ? (
              <ChipRow label={statusLabel}>
                {statusOptions.map((opt) => (
                  <FilterChip
                    key={`st-${opt.value}`}
                    href={buildHref(pathname, current, { status: opt.value })}
                    active={(status ?? "all") === opt.value}
                  >
                    {opt.label}
                  </FilterChip>
                ))}
              </ChipRow>
            ) : null}
            {typeOptions ? (
              <ChipRow label={typeLabel}>
                {typeOptions.map((opt) => (
                  <FilterChip
                    key={`ty-${opt.value}`}
                    href={buildHref(pathname, current, { type: opt.value })}
                    active={(type ?? "all") === opt.value}
                  >
                    {opt.label}
                  </FilterChip>
                ))}
              </ChipRow>
            ) : null}
          </div>
        ) : null}
        <form method="get" className="sm:max-w-xs">
          <input type="hidden" name="period" value={period} />
          {status && status !== "all" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          {type && type !== "all" ? (
            <input type="hidden" name="type" value={type} />
          ) : null}
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
