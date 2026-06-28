import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { CoursesManager } from "./courses-manager";

export default async function FormationsPage() {
  const session = await requireModule("academie");
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("acad_courses")
    .select("id, title, description, price_cents, currency, is_published")
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Formations" />
      <CoursesManager courses={courses ?? []} />
    </div>
  );
}
