"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import type { Database, Json } from "@/lib/db/database.types";

type TenantModuleInsert = Database["public"]["Tables"]["tenant_modules"]["Insert"];

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

const LIMIT_KEYS = ["staff", "clients", "appointments_per_month", "students"] as const;

const FEATURE_KEYS = [
  { key: "calendar_enabled", label: "Calendrier RDV" },
  { key: "client_booking_enabled", label: "Reservation client en ligne" },
  { key: "sms_enabled", label: "Notifications SMS" },
] as const;

function parseFeatures(formData: FormData): Record<string, boolean> {
  const features: Record<string, boolean> = {};
  for (const f of FEATURE_KEYS) {
    features[f.key] = formData.get(`feature_${f.key}`) === "on";
  }
  return features;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function eurosToCents(value: string): number {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function parseLimits(formData: FormData): Record<string, number | null> {
  const limits: Record<string, number | null> = {};
  for (const key of LIMIT_KEYS) {
    const raw = String(formData.get(`limit_${key}`) ?? "").trim();
    limits[key] = raw === "" ? null : Math.max(0, Number.parseInt(raw, 10) || 0);
  }
  return limits;
}

async function enablePlanModules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  moduleIds: string[],
) {
  if (moduleIds.length === 0) return;
  await supabase.from("tenant_modules").upsert(
    moduleIds.map(
      (module_id): TenantModuleInsert => ({
        tenant_id: tenantId,
        module_id,
        enabled: true,
      }),
    ),
    { onConflict: "tenant_id,module_id" },
  );
}

export async function createTenant(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const actions = await getTranslations("institut.actions");
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const planId = String(formData.get("plan_id") ?? "") || null;
  const ownerEmail = String(formData.get("owner_email") ?? "").trim();
  const ownerPassword = String(formData.get("owner_password") ?? "");

  if (!name || !slug) return { error: actions("nameSlugRequired") };

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("is_platform", true)
    .maybeSingle();
  if (!brand) return { error: actions("platformBrandNotFound") };

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({ name, slug, brand_id: brand.id })
    .select("id")
    .single();
  if (tErr || !tenant) {
    return {
      error: tErr?.message.includes("duplicate")
        ? actions("slugTaken", { slug })
        : (tErr?.message ?? actions("tenantCreateError")),
    };
  }

  if (planId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("modules")
      .eq("id", planId)
      .maybeSingle();
    await supabase
      .from("subscriptions")
      .upsert(
        { tenant_id: tenant.id, plan_id: planId, status: "active" },
        { onConflict: "tenant_id" },
      );
    if (plan?.modules) await enablePlanModules(supabase, tenant.id, plan.modules);
  }

  if (ownerEmail && ownerPassword) {
    try {
      const service = createServiceClient();
      const { data: created, error: uErr } = await service.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
      });
      if (uErr || !created.user) {
        throw new Error(uErr?.message ?? "creation utilisateur impossible");
      }
      await supabase.from("memberships").insert({
        user_id: created.user.id,
        tenant_id: tenant.id,
        role: "tenant_owner",
      });
    } catch (e) {
      revalidatePath("/admin/tenants");
      return {
        ok: true,
        message: actions("tenantCreatedOwnerFailed", { message: (e as Error).message }),
      };
    }
  }

  revalidatePath("/admin/tenants");
  redirect(`/admin/tenants/${tenant.id}`);
}

export async function updateTenant(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const actions = await getTranslations("institut.actions");
  const supabase = await createClient();

  const id = String(formData.get("tenant_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  if (!id || !name || !slug) return { error: actions("missingRequiredFields") };

  const { error } = await supabase
    .from("tenants")
    .update({ name, slug })
    .eq("id", id);
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? actions("slugTaken", { slug })
        : error.message,
    };
  }
  revalidatePath(`/admin/tenants/${id}`);
  return { ok: true, message: actions("tenantUpdated") };
}

export async function setTenantPlan(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const planId = String(formData.get("plan_id") ?? "") || null;
  if (!tenantId) return;

  await supabase
    .from("subscriptions")
    .upsert(
      { tenant_id: tenantId, plan_id: planId, status: "active" },
      { onConflict: "tenant_id" },
    );

  if (planId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("modules")
      .eq("id", planId)
      .maybeSingle();
    if (plan?.modules) await enablePlanModules(supabase, tenantId, plan.modules);
  }
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/subscriptions");
}

export async function toggleTenantModule(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!tenantId || !moduleId) return;

  await supabase
    .from("tenant_modules")
    .upsert(
      { tenant_id: tenantId, module_id: moduleId, enabled },
      { onConflict: "tenant_id,module_id" },
    );
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/subscriptions");
}

export async function savePlan(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const actions = await getTranslations("institut.actions");
  const supabase = await createClient();

  const id = String(formData.get("plan_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: actions("planNameRequired") };

  const payload = {
    name,
    price_cents: eurosToCents(String(formData.get("price") ?? "0")),
    interval: String(formData.get("interval") ?? "month") === "year" ? "year" : "month",
    is_active: String(formData.get("is_active") ?? "") === "on",
    modules: formData.getAll("modules").map(String),
    limits: parseLimits(formData) as Json,
    features: parseFeatures(formData) as Json,
  };

  if (id) {
    const { error } = await supabase.from("plans").update(payload).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("plans")
      .insert({ ...payload, brand_id: null });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/plans");
  redirect("/admin/plans");
}

export async function setSubscriptionStatus(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!tenantId || !status) return;

  await supabase.from("subscriptions").update({ status }).eq("tenant_id", tenantId);
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/subscriptions");
}

export async function createBrand(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.brands");
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  if (!name || !slug) return { error: t("errors.required") };

  const { error } = await supabase.from("brands").insert({ name, slug });
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? t("errors.slugTaken", { slug })
        : error.message,
    };
  }

  revalidatePath("/admin/brands");
  return { ok: true, message: t("created") };
}

export async function updateBrand(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.brands");
  const supabase = await createClient();

  const id = String(formData.get("brand_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  if (!id || !name || !slug) return { error: t("errors.required") };

  const { data: brand } = await supabase
    .from("brands")
    .select("is_platform")
    .eq("id", id)
    .maybeSingle();
  if (!brand) return { error: t("errors.notFound") };
  if (brand.is_platform) return { error: t("errors.platformBrand") };

  const { error } = await supabase.from("brands").update({ name, slug }).eq("id", id);
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? t("errors.slugTaken", { slug })
        : error.message,
    };
  }

  revalidatePath("/admin/brands");
  return { ok: true, message: t("updated") };
}

export async function updateModuleCatalog(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.modules");
  const supabase = await createClient();

  const id = String(formData.get("module_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const version = String(formData.get("version") ?? "").trim() || "1.0.0";
  const isActive = String(formData.get("is_active") ?? "") === "on";

  if (!id || !name) return { error: t("errors.required") };

  const { error } = await supabase
    .from("modules")
    .update({ name, description, category, version, is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/modules");
  return { ok: true, message: t("updated") };
}

export async function toggleModuleActive(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const moduleId = String(formData.get("module_id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";
  if (!moduleId) return;

  await supabase.from("modules").update({ is_active: isActive }).eq("id", moduleId);
  revalidatePath("/admin/modules");
}

export async function invitePlatformAdmin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.team");
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: t("errors.required") };

  try {
    const service = createServiceClient();
    const { data: created, error: uErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (uErr || !created.user) {
      return { error: uErr?.message ?? t("errors.createUser") };
    }

    const { error: mErr } = await supabase.from("memberships").insert({
      user_id: created.user.id,
      role: "platform_admin",
    });
    if (mErr) return { error: mErr.message };
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/admin/team");
  return { ok: true, message: t("invited") };
}

export async function revokePlatformAdmin(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const t = await getTranslations("admin.team");
  const membershipId = String(formData.get("membership_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!membershipId || !userId) return;

  if (userId === session.userId) {
    throw new Error(t("errors.selfRevoke"));
  }

  const supabase = await createClient();
  await supabase.from("memberships").delete().eq("id", membershipId);
  revalidatePath("/admin/team");
}
