import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EnrollmentsManager } from "./enrollments-manager";

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

  const enrollmentRows = (enrollments ?? []).map((e) => ({
    id: e.id,
    student_name: e.student_name,
    student_email: e.student_email,
    status: e.status,
    acad_courses: Array.isArray(e.acad_courses)
      ? (e.acad_courses[0] as { title: string } | undefined) ?? null
      : (e.acad_courses as { title: string } | null),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Eleves" />
      <EnrollmentsManager
        enrollments={enrollmentRows}
        courses={courses ?? []}
        clients={clients ?? []}
      />
    </div>
  );
}
