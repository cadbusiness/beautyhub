import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { buildCatalog, type PosCatalogItem } from "@/lib/institut/pos";
import { getPosSettings, type PosSettings } from "@/lib/institut/pos-settings";
import { getOpenCashSession } from "@/lib/institut/pos-session";

type Db = SupabaseClient<Database>;

export interface MobilePosClientOption {
  id: string;
  label: string;
}

export interface MobilePosStaffOption {
  id: string;
  label: string;
}

export interface MobilePosContext {
  catalog: PosCatalogItem[];
  settings: PosSettings;
  clients: MobilePosClientOption[];
  staff: MobilePosStaffOption[];
  sessionOpen: boolean;
  requireOpenSession: boolean;
  wooConnected: boolean;
}

type MobilePosContextLoaded = MobilePosContext & {
  _services: Array<{
    id: string;
    description: string | null;
    visibility?: string | null;
  }>;
  _products: Array<{
    id: string;
    stock_quantity: number | null;
    woo_id: number | null;
    source: string | null;
  }>;
};

export async function loadMobilePosContext(
  supabase: Db,
  tenantId: string,
): Promise<MobilePosContextLoaded> {
  const [servicesRes, productsRes, clientsRes, staffRes, posSettings, cashSession, wooRes] =
    await Promise.all([
      supabase
        .from("inst_services")
        .select(
          "id, name, description, price_cents, color, duration_min, image_url, visibility",
        )
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("inst_products")
        .select(
          "id, name, price_cents, image_url, source, sku, status, woo_id, woo_categories, stock_quantity",
        )
        .eq("tenant_id", tenantId)
        .in("status", ["active", "publish"])
        .order("name"),
      supabase
        .from("clients")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("inst_staff")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .order("full_name"),
      getPosSettings(supabase, tenantId),
      getOpenCashSession(supabase, tenantId),
      supabase
        .from("connections")
        .select("status")
        .eq("scope_type", "tenant")
        .eq("scope_id", tenantId)
        .eq("provider", WOO_PROVIDER)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const catalog = buildCatalog(servicesRes.data ?? [], productsRes.data ?? []);
  const clients = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
  }));
  const staff = (staffRes.data ?? []).map((s) => ({
    id: s.id,
    label: s.full_name,
  }));

  return {
    catalog,
    settings: posSettings,
    clients,
    staff,
    sessionOpen: Boolean(cashSession),
    requireOpenSession: posSettings.require_open_session,
    wooConnected: wooRes.data?.status === "connected",
    _services: servicesRes.data ?? [],
    _products: productsRes.data ?? [],
  };
}

export function serializeMobilePosContext(ctx: MobilePosContextLoaded) {
  const serviceById = new Map((ctx._services ?? []).map((s) => [s.id, s]));
  const productById = new Map((ctx._products ?? []).map((p) => [p.id, p]));

  return {
    catalog: ctx.catalog.map((item) =>
      serializeCatalogItem(item, serviceById, productById),
    ),
    settings: {
      currency: ctx.settings.currency,
      priceDisplay: ctx.settings.price_display,
      requireOpenSession: ctx.settings.require_open_session,
      paymentMethods: ctx.settings.payment_methods,
    },
    clients: ctx.clients,
    staff: ctx.staff,
    sessionOpen: ctx.sessionOpen,
    requireOpenSession: ctx.requireOpenSession,
    wooConnected: ctx.wooConnected,
  };
}

function serializeCatalogItem(
  item: PosCatalogItem,
  serviceById: Map<
    string,
    { id: string; description: string | null; visibility?: string | null }
  >,
  productById: Map<
    string,
    { id: string; stock_quantity: number | null; woo_id: number | null; source: string | null }
  >,
) {
  const base = {
    key: item.key,
    type: item.type,
    id: item.id,
    name: item.name,
    priceCents: item.price_cents,
    imageUrl: item.image_url,
    color: item.color,
    category: item.category,
    durationMin: item.duration_min ?? null,
    sku: item.sku ?? null,
    wooCategories: item.woo_categories ?? [],
    description: null as string | null,
    stockQuantity: null as number | null,
    wooId: null as number | null,
    source: null as string | null,
    visibility: null as string | null,
  };

  if (item.type === "service") {
    const s = serviceById.get(item.id);
    return {
      ...base,
      description: s?.description ?? null,
      visibility: s?.visibility ?? item.visibility ?? null,
    };
  }

  const p = productById.get(item.id);
  return {
    ...base,
    stockQuantity: p?.stock_quantity ?? null,
    wooId: p?.woo_id ?? null,
    source: p?.source ?? item.category,
  };
}
