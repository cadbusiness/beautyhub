"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { assertQuota, QuotaExceededError } from "@/lib/quota";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

function eurosToCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function createCourse(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("academie");
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Titre requis." };

  const { error } = await supabase.from("acad_courses").insert({
    tenant_id: session.tenant.id,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents: eurosToCents(formData.get("price")),
    is_published: formData.get("is_published") === "on",
  });
  if (error) return { error: error.message };
  revalidatePath("/academie");
  revalidatePath("/academie/formations");
  return { ok: true };
}

export async function deleteCourse(formData: FormData): Promise<void> {
  await requireModule("academie");
  const supabase = await createClient();
  await supabase
    .from("acad_courses")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath("/academie");
  revalidatePath("/academie/formations");
}

export async function createEnrollment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("academie");
  try {
    await assertQuota(session.tenant.id, "students");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { error: e.message };
    throw e;
  }

  const supabase = await createClient();
  const courseId = String(formData.get("course_id") ?? "");
  const studentEmail = String(formData.get("student_email") ?? "").trim().toLowerCase();
  const studentName = String(formData.get("student_name") ?? "").trim();
  if (!courseId || !studentEmail || !studentName) {
    return { error: "Formation, nom et email requis." };
  }

  const { data: course } = await supabase
    .from("acad_courses")
    .select("id")
    .eq("id", courseId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!course) return { error: "Formation introuvable." };

  const clientId = String(formData.get("client_id") ?? "") || null;

  const { error } = await supabase.from("acad_enrollments").insert({
    tenant_id: session.tenant.id,
    course_id: courseId,
    client_id: clientId,
    student_email: studentEmail,
    student_name: studentName,
  });
  if (error) return { error: error.message };
  revalidatePath("/academie");
  revalidatePath("/academie/eleves");
  return { ok: true };
}
