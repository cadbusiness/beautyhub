import { formatPrice } from "@/lib/utils";

export interface CashBreakdownLine {
  key: string;
  label: string;
  cents: number;
  sign: "+" | "−" | "=" | " ";
}

export type CashBreakdownLabelKey =
  | "openingFloat"
  | "cashSales"
  | "movementsIn"
  | "movementsOut"
  | "movementsExpense"
  | "expectedCash";

export function buildCashBreakdownLines(
  t: (key: CashBreakdownLabelKey) => string,
  data: {
    openingFloatCents: number;
    cashSalesCents: number;
    movementsInCents: number;
    movementsOutCents: number;
    movementsExpenseCents: number;
    expectedCashCents: number;
  },
): CashBreakdownLine[] {
  return [
    { key: "opening", label: t("openingFloat"), cents: data.openingFloatCents, sign: " " },
    { key: "cashSales", label: t("cashSales"), cents: data.cashSalesCents, sign: "+" },
    { key: "in", label: t("movementsIn"), cents: data.movementsInCents, sign: "+" },
    { key: "out", label: t("movementsOut"), cents: data.movementsOutCents, sign: "−" },
    { key: "expense", label: t("movementsExpense"), cents: data.movementsExpenseCents, sign: "−" },
    { key: "expected", label: t("expectedCash"), cents: data.expectedCashCents, sign: "=" },
  ];
}

export function CashBreakdownTable({
  lines,
  compact = false,
}: {
  lines: CashBreakdownLine[];
  compact?: boolean;
}) {
  return (
    <dl className={compact ? "space-y-1.5 text-sm" : "space-y-2 text-sm"}>
      {lines.map((line) => {
        const isTotal = line.key === "expected";
        return (
          <div
            key={line.key}
            className={
              isTotal
                ? "flex items-center justify-between gap-4 border-t border-slate-200 pt-2 font-medium text-slate-900"
                : "flex items-center justify-between gap-4 text-slate-600"
            }
          >
            <dt className="flex min-w-0 items-center gap-2">
              {line.sign !== " " ? (
                <span className="w-3 shrink-0 tabular-nums text-slate-400">{line.sign}</span>
              ) : (
                <span className="w-3 shrink-0" aria-hidden />
              )}
              <span>{line.label}</span>
            </dt>
            <dd className="shrink-0 tabular-nums">{formatPrice(line.cents)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
