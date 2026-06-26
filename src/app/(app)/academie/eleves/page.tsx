import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EnrollmentForm } from "./enrollment-form";

const STATUS_LABELS: Record<string, string> = {
  enrolled: "Inscrit",
  completed: "Termine",
  cancelled: "Annule",
};

export default async function ElevesPage() {
  const session = await requireModule("academie");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [{ data: enrollments }, { data: courses }, { data: clients }] = await Promise.all([
    supabase
      .from("acad_enrollments")
      .select("id, student_name, student_email, status, created_at, acad_courses(title)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("acad_courses")
      .select("id, title")
      .eq("tenant_id", tenantId)
      .order("title", { ascending: true }),
    supabase
      .from("clients")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .order("full_name", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        Eleves
      </h1>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden p-0">
          {(enrollments ?? []).length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucune inscription pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Eleve</th>
                  <th className="px-4 py-3 font-medium">Formation</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {(enrollments ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="text-slate-900 dark:text-white">{e.student_name}</p>
                      <p className="text-slate-500">{e.student_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {(e.acad_courses as { title: string } | null)?.title ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {STATUS_LABELS[e.status] ?? e.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="h-fit">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Nouvelle inscription
          </h2>
          <EnrollmentForm courses={courses ?? []} clients={clients ?? []} />
        </Card>
      </div>
    </div>
  );
}
