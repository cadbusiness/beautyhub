import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/lib/db/database.types";
import { saveTenantConnection, disconnectTenantConnection } from "@/lib/connections";
import { apiBaseUrl } from "@/lib/app-url";

export const BOOKLY_PROVIDER = "bookly";

export type BooklySyncStatus = {
  enabled: boolean;
  url: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

function syncUrl(token: string): string {
  return `${apiBaseUrl()}/api/webhooks/bookly/${token}`;
}

function statusFromRow(
  data: { status: string; config: unknown } | null,
): BooklySyncStatus {
  if (!data || data.status !== "connected") {
    return { enabled: false, url: null, lastSyncAt: null, lastError: null };
  }
  const config = (data.config as Record<string, unknown>) ?? {};
  const token = typeof config.webhook_token === "string" ? config.webhook_token : null;
  return {
    enabled: Boolean(token),
    url: token ? syncUrl(token) : null,
    lastSyncAt: typeof config.last_sync_at === "string" ? config.last_sync_at : null,
    lastError: typeof config.last_error === "string" ? config.last_error : null,
  };
}

export async function getBooklySyncStatus(tenantId: string): Promise<BooklySyncStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connections")
    .select("status, config")
    .eq("provider", BOOKLY_PROVIDER)
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .maybeSingle();

  return statusFromRow(data);
}

export async function enableBooklySync(tenantId: string): Promise<BooklySyncStatus> {
  const existing = await getBooklySyncStatus(tenantId);
  const token =
    existing.enabled && existing.url
      ? existing.url.replace(/^.*\//, "")
      : randomBytes(24).toString("hex");
  await saveTenantConnection(
    tenantId,
    BOOKLY_PROVIDER,
    {},
    {
      webhook_token: token,
      last_sync_at: existing.lastSyncAt,
      last_error: null,
    },
    "connected",
  );
  return {
    enabled: true,
    url: syncUrl(token),
    lastSyncAt: existing.lastSyncAt,
    lastError: null,
  };
}

export async function rotateBooklySync(tenantId: string): Promise<BooklySyncStatus> {
  const token = randomBytes(24).toString("hex");
  await saveTenantConnection(
    tenantId,
    BOOKLY_PROVIDER,
    {},
    { webhook_token: token, last_sync_at: null, last_error: null },
    "connected",
  );
  return { enabled: true, url: syncUrl(token), lastSyncAt: null, lastError: null };
}

export async function disableBooklySync(tenantId: string): Promise<BooklySyncStatus> {
  await disconnectTenantConnection(tenantId, BOOKLY_PROVIDER);
  return { enabled: false, url: null, lastSyncAt: null, lastError: null };
}

export async function resolveBooklyWebhookTenant(
  token: string,
): Promise<{ connectionId: string; tenantId: string } | null> {
  if (!token || token.length < 16) return null;

  const service = tryCreateServiceClient();
  if (service) {
    const { data } = await service
      .from("connections")
      .select("id, scope_id, status, config")
      .eq("provider", BOOKLY_PROVIDER)
      .eq("scope_type", "tenant")
      .eq("status", "connected")
      .filter("config->>webhook_token", "eq", token)
      .maybeSingle();
    if (data?.scope_id) return { connectionId: data.id, tenantId: data.scope_id };
  }

  const env = requireSupabaseEnv();
  const anon = createSupabaseClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await anon.rpc("bookly_resolve_webhook", { p_token: token });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.connection_id || !row?.tenant_id) return null;
  return { connectionId: row.connection_id, tenantId: row.tenant_id };
}

export function createBooklyWebhookClient(token: string) {
  const service = tryCreateServiceClient();
  if (service) return service;
  const env = requireSupabaseEnv();
  return createSupabaseClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-bookly-webhook-token": token } },
  });
}

export type BooklyImportPayloadResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  cancelled: number;
  missingService: number;
  resourcesCreated: number;
  errors: string[];
};

function asImportResult(value: unknown): BooklyImportPayloadResult {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const errors = Array.isArray(row.errors)
    ? row.errors.filter((e): e is string => typeof e === "string")
    : [];
  return {
    ok: row.ok !== false,
    created: Number(row.created) || 0,
    updated: Number(row.updated) || 0,
    skipped: Number(row.skipped) || 0,
    cancelled: Number(row.cancelled) || 0,
    missingService: Number(row.missingService) || 0,
    resourcesCreated: Number(row.resourcesCreated) || 0,
    errors,
  };
}

export async function importBooklyWebhookPayload(input: {
  token: string;
  rows: unknown;
  keepIds: number[];
  mode: "upsert" | "full";
}): Promise<BooklyImportPayloadResult> {
  const env = requireSupabaseEnv();
  const anon = createSupabaseClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("bookly_import_payload", {
    p_token: input.token,
    p_rows: (Array.isArray(input.rows) ? input.rows : []) as Json,
    p_keep_ids: input.keepIds,
    p_mode: input.mode,
  });
  if (error) throw new Error(error.message);
  return asImportResult(data);
}

export async function markBooklySyncResult(
  connectionId: string,
  error: string | null,
  token?: string,
): Promise<void> {
  const supabase = token ? createBooklyWebhookClient(token) : tryCreateServiceClient();
  if (!supabase) return;
  const { data } = await supabase
    .from("connections")
    .select("config")
    .eq("id", connectionId)
    .maybeSingle();
  const prev = (data?.config as Record<string, unknown>) ?? {};
  await supabase
    .from("connections")
    .update({
      config: {
        ...prev,
        last_sync_at: new Date().toISOString(),
        last_error: error,
      },
    })
    .eq("id", connectionId);
}
