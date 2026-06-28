import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ListPanel } from "@/components/ui/list-panel";

export default async function InstitutHome() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [services, clients, upcoming] = await Promise.all([
    supabase
      .from("inst_services")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("inst_appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelled"),
  ]);

  const stats = [
    { label: "RDV à venir", value: upcoming.count ?? 0, href: "/institut/rendez-vous" },
    { label: "Clients", value: clients.count ?? 0, href: "/institut/clients" },
    { label: "Prestations", value: services.count ?? 0, href: "/institut/prestations" },
  ];

  return (
    <ListPanel>
      <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="px-4 py-5 transition-colors hover:bg-slate-50 lg:px-6"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>
    </ListPanel>
  );
}
