"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getTenantPublicBaseUrl } from "@/lib/tenant/public-site";
import type { Json } from "@/lib/db/database.types";
import {
  defaultBlocksForPageType,
  defaultTitleForPageType,
  parseSiteBlocks,
  SITE_PAGE_TYPES,
  type SiteBlock,
  type SitePageRow,
  type SitePageType,
  type SiteTemplateId,
} from "@/lib/institut/site-pages";

const ADMIN_PATH = "/institut/marketing/page-web";

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string };

function mapRow(row: {
  id: string;
  tenant_id: string;
  page_type: string;
  slug: string;
  template_id: string;
  title: string;
  is_published: boolean;
  is_home: boolean;
  content: unknown;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}): SitePageRow {
  return {
    ...row,
    page_type: row.page_type as SitePageRow["page_type"],
    template_id: row.template_id as SitePageRow["template_id"],
    content: parseSiteBlocks(row.content),
  };
}

export async function ensureDefaultSitePages(tenantId: string, instituteName: string): Promise<void> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("inst_site_pages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if ((count ?? 0) > 0) return;

  const inserts = SITE_PAGE_TYPES.map((def) => ({
    tenant_id: tenantId,
    page_type: def.type,
    slug: def.defaultSlug,
    title: defaultTitleForPageType(def.type, instituteName),
    is_home: def.type === "home",
    is_published: def.type === "home",
    template_id: "elegant" as SiteTemplateId,
    content: defaultBlocksForPageType(def.type, instituteName) as unknown as Json,
  }));

  await supabase.from("inst_site_pages").insert(inserts);
}

export async function loadSitePagesAdmin(): Promise<{
  pages: SitePageRow[];
  publicBaseUrl: string;
}> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  await ensureDefaultSitePages(session.tenant.id, session.tenant.name);

  const { data } = await supabase
    .from("inst_site_pages")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .order("is_home", { ascending: false })
    .order("created_at");

  const publicBaseUrl = await getTenantPublicBaseUrl(session.tenant.slug, session.tenant);

  return {
    pages: (data ?? []).map((row) => mapRow(row)),
    publicBaseUrl,
  };
}

export async function loadSitePageForBuilder(pageId: string): Promise<SitePageRow | null> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data } = await supabase
    .from("inst_site_pages")
    .select("*")
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  return data ? mapRow(data) : null;
}

export async function createSitePage(pageType: SitePageType): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const def = SITE_PAGE_TYPES.find((p) => p.type === pageType);
  if (!def) return { error: "Type de page invalide." };

  if (pageType === "home") {
    const { data: existing } = await supabase
      .from("inst_site_pages")
      .select("id")
      .eq("tenant_id", session.tenant.id)
      .eq("page_type", "home")
      .maybeSingle();
    if (existing) return { error: "Une page d'accueil existe déjà." };
  }

  const { data, error } = await supabase
    .from("inst_site_pages")
    .insert({
      tenant_id: session.tenant.id,
      page_type: pageType,
      slug: def.defaultSlug,
      title: defaultTitleForPageType(pageType, session.tenant.name),
      is_home: pageType === "home",
      template_id: "elegant",
      content: defaultBlocksForPageType(pageType, session.tenant.name) as unknown as Json,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(ADMIN_PATH);
  return { ok: true, id: data.id };
}

export async function saveSitePageBuilder(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const templateId = String(formData.get("template_id") ?? "elegant") as SiteTemplateId;
  const title = String(formData.get("title") ?? "").trim();
  const blocksJson = String(formData.get("blocks_json") ?? "[]");
  const seoTitle = String(formData.get("seo_title") ?? "").trim() || null;
  const seoDescription = String(formData.get("seo_description") ?? "").trim() || null;
  const isPublished = formData.get("is_published") === "1";

  if (!id || !title) return { error: "Données invalides." };

  let blocks: SiteBlock[];
  try {
    blocks = parseSiteBlocks(JSON.parse(blocksJson));
  } catch {
    return { error: "Contenu invalide." };
  }

  const { error } = await supabase
    .from("inst_site_pages")
    .update({
      template_id: templateId,
      title,
      content: blocks as unknown as Json,
      seo_title: seoTitle,
      seo_description: seoDescription,
      is_published: isPublished,
    })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${id}/builder`);
  return { ok: true, message: "Page enregistrée." };
}

export async function deleteSitePage(pageId: string): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("inst_site_pages")
    .select("is_home, page_type")
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!page) return { error: "Page introuvable." };
  if (page.is_home) return { error: "La page d'accueil ne peut pas être supprimée." };

  const { error } = await supabase
    .from("inst_site_pages")
    .delete()
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
