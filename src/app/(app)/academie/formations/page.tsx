import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { CourseForm } from "./course-form";
import { deleteCourse } from "../actions";

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
 <h1 className="text-2xl font-semibold text-slate-900">
 Formations
 </h1>

 <div className="grid gap-6 md:grid-cols-[1fr_360px]">
 <div className="space-y-3">
 {(courses ?? []).length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucune formation pour le moment.</p>
 </Card>
 ) : (
 (courses ?? []).map((c) => (
 <Card key={c.id} className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2">
 <p className="font-medium text-slate-900">{c.title}</p>
 {c.is_published ? (
 <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
 Publiee
 </span>
 ) : (
 <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
 Brouillon
 </span>
 )}
 </div>
 <p className="text-sm text-slate-500">
 {formatPrice(c.price_cents, c.currency)}
 </p>
 {c.description ? (
 <p className="mt-1 text-sm text-slate-400">{c.description}</p>
 ) : null}
 </div>
 <form action={deleteCourse}>
 <input type="hidden" name="id" value={c.id} />
 <Button variant="ghost" type="submit" className="text-red-600">
 Supprimer
 </Button>
 </form>
 </Card>
 ))
 )}
 </div>

 <Card className="h-fit">
 <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Nouvelle formation
 </h2>
 <CourseForm />
 </Card>
 </div>
 </div>
 );
}
