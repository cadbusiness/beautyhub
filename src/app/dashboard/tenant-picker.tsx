import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { selectTenant } from "./actions";

export interface TenantOption {
  slug: string;
  name: string;
  role: string;
}

export function TenantPicker({ tenants }: { tenants: TenantOption[] }) {
  if (tenants.length === 0) return null;

  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Choisir un institut
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Sur le domaine principal, selectionne l&apos;institut auquel tu veux acceder.
      </p>
      <ul className="mt-4 space-y-2">
        {tenants.map((t) => (
          <li key={t.slug}>
            <form action={selectTenant} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">
                  {t.slug} · {t.role}
                </p>
              </div>
              <input type="hidden" name="slug" value={t.slug} />
              <Button type="submit" variant="outline">
                Ouvrir
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}
