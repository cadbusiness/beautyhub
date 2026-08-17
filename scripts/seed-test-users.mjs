#!/usr/bin/env node
/**
 * Provisionne l'institut sandbox + les comptes equipe de test.
 * Ne touche pas aux instituts clients (ex. Escale des sens).
 *
 * Usage: node scripts/seed-test-users.mjs
 * Requiert SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL dans .env.local
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  const raw = readFileSync(path, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const PLATFORM_BRAND_ID = "00000000-0000-0000-0000-0000000000b1";
const SANDBOX_TENANT_ID = "00000000-0000-0000-0000-0000000000d2";
const ORPHAN_DEMO_OWNER_ID = "00000000-0000-0000-0000-0000000000a1";
const DEMO_SLUG = "demo";
const TEST_PASSWORD = "BeautyHub2026!";

const SYSTEM_ROLES = [
  {
    name: "Propriétaire",
    slug: "owner",
    description: "Accès complet à l'espace institut",
    permissions: { "*": { read: true, write: true } },
  },
  {
    name: "Manager",
    slug: "manager",
    description: "Gestion quotidienne sans paramètres sensibles",
    permissions: {
      dashboard: { read: true },
      appointments: { read: true, write: true },
      clients: { read: true, write: true },
      services: { read: true, write: true },
      team: { read: true },
      pos: { read: true, write: true },
      marketing: { read: true },
    },
  },
  {
    name: "Praticienne",
    slug: "practitioner",
    description: "Agenda et consultation fiches clients",
    permissions: {
      dashboard: { read: true },
      appointments: { read: true, write: true },
      clients: { read: true },
      services: { read: true },
    },
  },
  {
    name: "Réception",
    slug: "reception",
    description: "Accueil, RDV et caisse",
    permissions: {
      dashboard: { read: true },
      appointments: { read: true, write: true },
      clients: { read: true, write: true },
      pos: { read: true, write: true },
    },
  },
];

function testUsers(demoTenantId) {
  return [
    {
      email: "admin@beautyhub.test",
      role: "platform_admin",
      brand_id: null,
      tenant_id: null,
    },
    {
      email: "brand@beautyhub.test",
      role: "brand_owner",
      brand_id: PLATFORM_BRAND_ID,
      tenant_id: null,
    },
    {
      email: "owner@demo.test",
      role: "tenant_owner",
      brand_id: null,
      tenant_id: demoTenantId,
    },
    {
      email: "staff@demo.test",
      role: "staff",
      brand_id: null,
      tenant_id: demoTenantId,
    },
    {
      email: "coach@demo.test",
      role: "coach",
      brand_id: null,
      tenant_id: demoTenantId,
    },
  ];
}

async function findUserIdByEmail(supabase, email) {
  const { data: mems } = await supabase.from("memberships").select("user_id");
  const ids = [...new Set((mems ?? []).map((m) => m.user_id))];
  for (const id of ids) {
    const { data } = await supabase.auth.admin.getUserById(id);
    if (data?.user?.email?.toLowerCase() === email.toLowerCase()) {
      return data.user.id;
    }
  }
  return null;
}

async function ensureDemoTenant(supabase) {
  const { data: bySlug } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (bySlug) {
    console.log(`  ~ Tenant sandbox: ${bySlug.name} (${bySlug.slug})`);
    return bySlug.id;
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("is_platform", true)
    .maybeSingle();
  if (!brand) {
    throw new Error("Brand plateforme introuvable");
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      id: SANDBOX_TENANT_ID,
      brand_id: brand.id,
      name: "Institut Demo",
      slug: DEMO_SLUG,
      branding: { primaryColor: "#0f172a", appName: "Institut Demo" },
    })
    .select("id")
    .single();
  if (error || !tenant) {
    throw new Error(error?.message ?? "Impossible de creer le tenant sandbox");
  }
  console.log("  + Tenant sandbox: Institut Demo (demo)");
  return tenant.id;
}

async function ensureModulesAndPlan(supabase, tenantId) {
  const { data: plan } = await supabase
    .from("plans")
    .select("id, modules")
    .eq("name", "Academie")
    .is("brand_id", null)
    .maybeSingle();

  const moduleIds = plan?.modules?.length ? plan.modules : ["institut", "academie"];
  const { error: modErr } = await supabase.from("tenant_modules").upsert(
    moduleIds.map((module_id) => ({
      tenant_id: tenantId,
      module_id,
      enabled: true,
    })),
    { onConflict: "tenant_id,module_id" },
  );
  if (modErr) console.error(`  ✗ Modules: ${modErr.message}`);
  else console.log(`  ~ Modules: ${moduleIds.join(", ")}`);

  if (plan) {
    const { error: subErr } = await supabase.from("subscriptions").upsert(
      { tenant_id: tenantId, plan_id: plan.id, status: "active" },
      { onConflict: "tenant_id" },
    );
    if (subErr) console.error(`  ✗ Abonnement: ${subErr.message}`);
    else console.log("  ~ Abonnement: Academie");
  }
}

async function ensureSystemRoles(supabase, tenantId) {
  for (const role of SYSTEM_ROLES) {
    const { data: existing } = await supabase
      .from("tenant_roles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", role.slug)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("tenant_roles").insert({
      tenant_id: tenantId,
      name: role.name,
      slug: role.slug,
      description: role.description,
      permissions: role.permissions,
      is_system: true,
    });
    if (error) console.error(`  ✗ Role ${role.slug}: ${error.message}`);
  }
  console.log("  ~ Roles systeme");
}

async function ensureSampleData(supabase, tenantId) {
  const { count: serviceCount } = await supabase
    .from("inst_services")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (!serviceCount) {
    const { error } = await supabase.from("inst_services").insert([
      {
        tenant_id: tenantId,
        name: "Soin du visage",
        description: "Nettoyage et hydratation",
        duration_min: 60,
        price_cents: 6500,
        color: "#78716c",
      },
      {
        tenant_id: tenantId,
        name: "Epilation jambes",
        description: "Cire chaude",
        duration_min: 30,
        price_cents: 3500,
        color: "#64748b",
      },
      {
        tenant_id: tenantId,
        name: "Manucure",
        description: "Pose vernis incluse",
        duration_min: 45,
        price_cents: 4000,
        color: "#57534e",
      },
    ]);
    if (error) console.error(`  ✗ Prestations: ${error.message}`);
    else console.log("  + Prestations demo");
  }

  const { count: staffCount } = await supabase
    .from("inst_staff")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (!staffCount) {
    const { error } = await supabase.from("inst_staff").insert([
      {
        tenant_id: tenantId,
        full_name: "Sophie Martin",
        email: "sophie@demo.test",
        color: "#78716c",
      },
      {
        tenant_id: tenantId,
        full_name: "Lea Dubois",
        email: "lea@demo.test",
        color: "#64748b",
      },
    ]);
    if (error) console.error(`  ✗ Personnel: ${error.message}`);
    else console.log("  + Personnel demo");
  }

  const { count: resourceCount } = await supabase
    .from("inst_resources")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (!resourceCount) {
    const { error } = await supabase.from("inst_resources").insert([
      { tenant_id: tenantId, name: "Cabine 1" },
      { tenant_id: tenantId, name: "Cabine 2" },
    ]);
    if (error) console.error(`  ✗ Cabines: ${error.message}`);
    else console.log("  + Cabines demo");
  }

  const { count: hoursCount } = await supabase
    .from("inst_working_hours")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (!hoursCount) {
    const { error } = await supabase.from("inst_working_hours").insert(
      [1, 2, 3, 4, 5].map((weekday) => ({
        tenant_id: tenantId,
        staff_id: null,
        weekday,
        start_time: "09:00",
        end_time: "18:00",
      })),
    );
    if (error) console.error(`  ✗ Horaires: ${error.message}`);
    else console.log("  + Horaires lun-ven 9h-18h");
  }

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", "eleve@demo.test")
    .maybeSingle();
  if (!existingClient) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        tenant_id: tenantId,
        email: "eleve@demo.test",
        full_name: "Marie Dupont",
        phone: "+33601020304",
      })
      .select("id")
      .single();
    if (error) console.error(`  ✗ Cliente demo: ${error.message}`);
    else console.log("  + Cliente demo Marie Dupont");

    const { data: course } = await supabase
      .from("acad_courses")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("title", "Initiation esthetique")
      .maybeSingle();
    let courseId = course?.id;
    if (!courseId) {
      const { data: created, error: courseErr } = await supabase
        .from("acad_courses")
        .insert({
          tenant_id: tenantId,
          title: "Initiation esthetique",
          description: "Bases du soin du visage et hygiene professionnelle.",
          price_cents: 49000,
          is_published: true,
        })
        .select("id")
        .single();
      if (courseErr) console.error(`  ✗ Formation: ${courseErr.message}`);
      else {
        courseId = created.id;
        console.log("  + Formation demo");
      }
    }
    if (courseId && client) {
      await supabase.from("acad_enrollments").insert({
        tenant_id: tenantId,
        course_id: courseId,
        client_id: client.id,
        student_email: "eleve@demo.test",
        student_name: "Marie Dupont",
        status: "enrolled",
      });
    }
  }
}

async function ensureAuthUser(supabase, email) {
  const existingId = await findUserIdByEmail(supabase, email);
  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password: TEST_PASSWORD,
    });
    if (error) {
      console.error(`  ✗ Auth ${email}: ${error.message}`);
      return existingId;
    }
    console.log(`  ~ Auth: ${email}`);
    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) {
    console.error(`  ✗ Auth ${email}: ${error.message}`);
    return null;
  }
  console.log(`  + Auth: ${email}`);
  return data.user.id;
}

async function ensureMembership(supabase, account, userId) {
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("role", account.role)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("memberships")
      .update({
        brand_id: account.brand_id,
        tenant_id: account.tenant_id,
      })
      .eq("id", existing.id);
    if (error) console.error(`  ✗ Membership ${account.email}: ${error.message}`);
    else console.log(`  ~ Membership: ${account.email} → ${account.role}`);
    return;
  }

  const { error } = await supabase.from("memberships").insert({
    user_id: userId,
    role: account.role,
    brand_id: account.brand_id,
    tenant_id: account.tenant_id,
  });
  if (error) console.error(`  ✗ Membership ${account.email}: ${error.message}`);
  else console.log(`  + Membership: ${account.email} → ${account.role}`);
}

async function detachTestUsersFromOtherTenants(supabase, demoTenantId, userIds) {
  if (userIds.length === 0) return;
  const { data: extras, error } = await supabase
    .from("memberships")
    .select("id, role, tenant_id, user_id")
    .in("user_id", userIds)
    .not("tenant_id", "is", null)
    .neq("tenant_id", demoTenantId);
  if (error) {
    console.error(`  ✗ Detache memberships: ${error.message}`);
    return;
  }
  for (const row of extras ?? []) {
    const { error: delErr } = await supabase.from("memberships").delete().eq("id", row.id);
    if (delErr) console.error(`  ✗ Detache ${row.id}: ${delErr.message}`);
    else console.log(`  - Membership retire d'un institut client (${row.role})`);
  }
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("→ Sandbox + comptes de test BeautyHub\n");

  const demoTenantId = await ensureDemoTenant(supabase);
  await ensureModulesAndPlan(supabase, demoTenantId);
  await ensureSystemRoles(supabase, demoTenantId);
  await ensureSampleData(supabase, demoTenantId);

  const { error: orphanErr } = await supabase
    .from("memberships")
    .delete()
    .eq("user_id", ORPHAN_DEMO_OWNER_ID);
  if (orphanErr) console.error(`  ✗ Orphelin owner: ${orphanErr.message}`);
  else console.log("  - Ancien membership owner demo orphelin retire");

  const accounts = testUsers(demoTenantId);
  const createdIds = [];
  for (const account of accounts) {
    const userId = await ensureAuthUser(supabase, account.email);
    if (!userId) continue;
    createdIds.push(userId);
    await ensureMembership(supabase, account, userId);
  }

  await detachTestUsersFromOtherTenants(supabase, demoTenantId, createdIds);

  console.log(`\nInstitut sandbox : demo (separe des instituts clients)`);
  console.log(`Mot de passe commun : ${TEST_PASSWORD}`);
  for (const account of accounts) {
    console.log(`  ${account.email.padEnd(24)} ${account.role}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
