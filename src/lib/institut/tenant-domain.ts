import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type TenantDomainSettings = {
  slug: string;
  customDomain: string | null;
  subdomainUrl: string;
  publicBaseUrl: string;
  rootDomain: string;
};

const HOSTNAME_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function getRootDomain(): string {
  return (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    process.env.VERCEL_URL ??
    "localhost:3000"
  );
}

function stripPort(value: string): string {
  return value.split(":")[0];
}

function protocolForHost(host: string): "http" | "https" {
  return host.includes("localhost") ? "http" : "https";
}

export function buildSubdomainUrl(slug: string, rootDomain = getRootDomain()): string {
  const root = stripPort(rootDomain).toLowerCase();
  const protocol = protocolForHost(root);
  return `${protocol}://${slug}.${root}`;
}

export function buildCustomDomainUrl(domain: string): string {
  const host = stripPort(domain).toLowerCase();
  const protocol = protocolForHost(host);
  return `${protocol}://${host}`;
}

export function normalizeCustomDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let value = trimmed.toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/\/.*$/, "");
  value = value.replace(/^www\./, "");
  value = stripPort(value);

  if (!value) return null;
  if (!HOSTNAME_RE.test(value)) return null;
  return value;
}

export async function fetchTenantDomainSettings(
  supabase: Db,
  tenantId: string,
  slug: string,
): Promise<TenantDomainSettings> {
  const rootDomain = getRootDomain();
  const { data } = await supabase
    .from("tenants")
    .select("custom_domain")
    .eq("id", tenantId)
    .maybeSingle();

  const customDomain = data?.custom_domain ?? null;
  const subdomainUrl = buildSubdomainUrl(slug, rootDomain);
  const publicBaseUrl = customDomain
    ? buildCustomDomainUrl(customDomain)
    : subdomainUrl;

  return {
    slug,
    customDomain,
    subdomainUrl,
    publicBaseUrl,
    rootDomain: stripPort(rootDomain).toLowerCase(),
  };
}

export async function saveTenantCustomDomain(
  supabase: Db,
  tenantId: string,
  slug: string,
  rawDomain: string,
): Promise<{ settings?: TenantDomainSettings; error?: string; code?: string }> {
  const normalized = normalizeCustomDomain(rawDomain);
  if (rawDomain.trim() && !normalized) {
    return { error: "invalid_domain", code: "invalid_domain" };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ custom_domain: normalized })
    .eq("id", tenantId);

  if (error) {
    if (error.code === "23505") {
      return { error: "domain_taken", code: "domain_taken" };
    }
    return { error: error.message, code: "save_failed" };
  }

  const settings = await fetchTenantDomainSettings(supabase, tenantId, slug);
  return { settings };
}

export async function resolveTenantPublicBaseUrl(
  supabase: Db,
  tenantId: string,
  slug: string,
): Promise<string> {
  const settings = await fetchTenantDomainSettings(supabase, tenantId, slug);
  return settings.publicBaseUrl;
}
