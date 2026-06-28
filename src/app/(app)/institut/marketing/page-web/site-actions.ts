"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getTenantPublicBaseUrl } from "@/lib/tenant/public-site";
import type { Json } from "@/lib/db/database.types";
import {
  defaultLayoutId,
  getLayoutDef,
  normalizeLayoutId,
} from "@/lib/institut/site-page-layouts";
import {
  defaultBlocksForPageType,
  defaultTitleForPageType,
  parseSiteBlocks,
  SITE_PAGE_TYPES,
  SITE_PAGE_TYPE_SORT,
  type SiteBlock,
  type SitePageRow,
  type SitePageType,
} from "@/lib/institut/site-pages";
import {
  parseSitePageStyle,
  type SitePageStyle,
} from "@/lib/institut/site-page-style";
import {
  ensureSiteSettings,
  type SiteSettingsRow,
} from "@/lib/institut/site-settings";

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
  show_in_nav?: boolean;
  sort_order?: number;
  content: unknown;
  seo_title: string | null;
  seo_description: string | null;
  page_style?: unknown;
  created_at: string;
  updated_at: string;
}): SitePageRow {
  const pageType = row.page_type as SitePageType;
  const defaults = SITE_PAGE_TYPE_SORT[pageType] ?? { sort_order: 0, show_in_nav: true };
  const { template_id: _dbLayout, ...rest } = row;
  return {
    ...rest,
    page_type: pageType,
    layout_id: normalizeLayoutId(pageType, row.template_id),
    show_in_nav: row.show_in_nav ?? defaults.show_in_nav,
    sort_order: row.sort_order ?? defaults.sort_order,
    content: parseSiteBlocks(row.content),
    page_style: parseSitePageStyle(row.page_style),
  };
}

function layoutBlocks(pageType: SitePageType, layoutId: string, instituteName: string): SiteBlock[] {
  const layout = getLayoutDef(pageType, layoutId);
  return layout?.blocks(instituteName) ?? defaultBlocksForPageType(pageType, instituteName);
}

export async function ensureDefaultSitePages(tenantId: string, instituteName: string): Promise<void> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("inst_site_pages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if ((count ?? 0) > 0) return;

  const inserts = SITE_PAGE_TYPES.map((def) => {
    const layoutId = defaultLayoutId(def.type);
    return {
      tenant_id: tenantId,
      page_type: def.type,
      slug: def.defaultSlug,
      title: defaultTitleForPageType(def.type, instituteName),
      is_home: def.type === "home",
      is_published: def.type === "home",
      show_in_nav: SITE_PAGE_TYPE_SORT[def.type].show_in_nav,
      sort_order: SITE_PAGE_TYPE_SORT[def.type].sort_order,
      template_id: layoutId,
      content: layoutBlocks(def.type, layoutId, instituteName) as unknown as Json,
    };
  });

  await supabase.from("inst_site_pages").insert(inserts);
}

const BUCKET = "site-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

async function uploadSiteImage(
  tenantId: string,
  folder: string,
  file: File,
): Promise<{ error?: string; url?: string }> {
  if (file.size > MAX_BYTES) return { error: "Image trop volumineuse (max 5 Mo)." };
  if (!ALLOWED.has(file.type)) {
    return { error: "Format non supporté (JPEG, PNG, WebP, GIF)." };
  }

  const supabase = await createClient();
  const path = `${tenantId}/${folder}/${crypto.randomUUID()}.${extForMime(file.type)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { error: upErr.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

export async function uploadSiteGalleryImage(
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const session = await requireModule("institut");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Fichier requis." };
  }
  return uploadSiteImage(session.tenant.id, "gallery", file);
}

export async function uploadSiteLogo(
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const session = await requireModule("institut");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Fichier requis." };
  }
  return uploadSiteImage(session.tenant.id, "logo", file);
}

export async function loadSitePagesAdmin(): Promise<{
  pages: SitePageRow[];
  publicBaseUrl: string;
  customDomain: string | null;
  homePageId: string | null;
}> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  await ensureDefaultSitePages(session.tenant.id, session.tenant.name);
  await ensureSiteSettings(supabase, session.tenant.id);

  const [{ data }, { data: tenantRow }] = await Promise.all([
    supabase
      .from("inst_site_pages")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("tenants")
      .select("custom_domain")
      .eq("id", session.tenant.id)
      .maybeSingle(),
  ]);

  const pages = (data ?? []).map((row) => mapRow(row));
  const publicBaseUrl = await getTenantPublicBaseUrl(session.tenant.slug, session.tenant);

  return {
    pages,
    publicBaseUrl,
    customDomain: tenantRow?.custom_domain ?? null,
    homePageId: pages.find((p) => p.is_home)?.id ?? null,
  };
}

export async function loadSiteSettingsAdmin(): Promise<SiteSettingsRow> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  await ensureDefaultSitePages(session.tenant.id, session.tenant.name);
  return ensureSiteSettings(supabase, session.tenant.id);
}

export async function saveSiteTheme(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const primaryColor = String(formData.get("primary_color") ?? "#0f172a").trim();
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;
  const footerText = String(formData.get("footer_text") ?? "").trim() || null;

  await ensureSiteSettings(supabase, session.tenant.id);

  const { error } = await supabase
    .from("inst_site_settings")
    .update({
      primary_color: primaryColor,
      display_name: displayName,
      logo_url: logoUrl,
      footer_text: footerText,
    })
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/theme`);
  return { ok: true, message: "Identité visuelle enregistrée." };
}

export async function applyPageLayout(
  pageId: string,
  layoutId: string,
  resetContent: boolean,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("inst_site_pages")
    .select("page_type")
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!page) return { error: "Page introuvable." };

  const pageType = page.page_type as SitePageType;
  const normalized = normalizeLayoutId(pageType, layoutId);
  const layout = getLayoutDef(pageType, normalized);
  if (!layout) return { error: "Modèle invalide." };

  const update: { template_id: string; content?: Json } = { template_id: normalized };
  if (resetContent) {
    update.content = layoutBlocks(pageType, normalized, session.tenant.name) as unknown as Json;
  }

  const { error } = await supabase
    .from("inst_site_pages")
    .update(update)
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${pageId}/builder`);
  revalidatePath(`${ADMIN_PATH}/${pageId}/preview`);
  return { ok: true };
}

export async function toggleSitePagePublished(
  pageId: string,
  published: boolean,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { error } = await supabase
    .from("inst_site_pages")
    .update({ is_published: published })
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${pageId}/preview`);
  return { ok: true };
}

export async function toggleSitePageNav(
  pageId: string,
  showInNav: boolean,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("inst_site_pages")
    .select("is_home")
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!page) return { error: "Page introuvable." };
  if (page.is_home) return { error: "L'accueil est toujours dans le menu." };

  const { error } = await supabase
    .from("inst_site_pages")
    .update({ show_in_nav: showInNav })
    .eq("id", pageId)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(ADMIN_PATH);
  return { ok: true };
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

  const layoutId = defaultLayoutId(pageType);
  const sort = SITE_PAGE_TYPE_SORT[pageType];

  const { data, error } = await supabase
    .from("inst_site_pages")
    .insert({
      tenant_id: session.tenant.id,
      page_type: pageType,
      slug: def.defaultSlug,
      title: defaultTitleForPageType(pageType, session.tenant.name),
      is_home: pageType === "home",
      show_in_nav: sort.show_in_nav,
      sort_order: sort.sort_order,
      template_id: layoutId,
      content: layoutBlocks(pageType, layoutId, session.tenant.name) as unknown as Json,
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
  const title = String(formData.get("title") ?? "").trim();
  const blocksJson = String(formData.get("blocks_json") ?? "[]");
  const seoTitle = String(formData.get("seo_title") ?? "").trim() || null;
  const seoDescription = String(formData.get("seo_description") ?? "").trim() || null;
  const isPublished = formData.get("is_published") === "1";
  const pageStyleJson = String(formData.get("page_style_json") ?? "{}");

  if (!id || !title) return { error: "Données invalides." };

  let blocks: SiteBlock[];
  let pageStyle: SitePageStyle;
  try {
    blocks = parseSiteBlocks(JSON.parse(blocksJson));
    pageStyle = parseSitePageStyle(JSON.parse(pageStyleJson));
  } catch {
    return { error: "Contenu invalide." };
  }

  const { error } = await supabase
    .from("inst_site_pages")
    .update({
      title,
      content: blocks as unknown as Json,
      seo_title: seoTitle,
      seo_description: seoDescription,
      is_published: isPublished,
      page_style: pageStyle as unknown as Json,
    })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${id}/builder`);
  revalidatePath(`${ADMIN_PATH}/${id}/preview`);
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
