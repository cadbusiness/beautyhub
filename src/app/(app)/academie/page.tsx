import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function AcademieHome() {
  const t = await getTranslations("academie.overview");
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
    { label: t("courses"), value: courses.count ?? 0, href: "/academie/formations" },
    { label: t("published"), value: published.count ?? 0, href: "/academie/formations" },
    { label: t("enrolledStudents"), value: enrollments.count ?? 0, href: "/academie/eleves" },
  ];

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-colors hover:border-slate-400">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {s.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
