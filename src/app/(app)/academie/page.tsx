import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function AcademieHome() {
  const session = await requireModule("academie");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [courses, published, enrollments] = await Promise.all([
    supabase
      .from("acad_courses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("acad_courses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_published", true),
    supabase
      .from("acad_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled"),
  ]);

  const stats = [
    { label: "Formations", value: courses.count ?? 0, href: "/academie/formations" },
    { label: "Publiees", value: published.count ?? 0, href: "/academie/formations" },
    { label: "Eleves inscrits", value: enrollments.count ?? 0, href: "/academie/eleves" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        Academie
      </h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-slate-400">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {s.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
