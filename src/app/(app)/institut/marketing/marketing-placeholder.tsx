import { Card } from "@/components/ui/card";

export function MarketingPlaceholder({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <div className="px-4 py-4 lg:px-6">
      <Card className="max-w-2xl space-y-3 p-6 shadow-none">
        <div>
          <h2 className="font-medium text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {hint ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {hint}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
