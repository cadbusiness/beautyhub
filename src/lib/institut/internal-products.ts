import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { looksLikeBarcode, normalizeScanCode } from "@/lib/institut/pos-scan";

function barcodeFromSku(sku: string | null | undefined): string | null {
  const code = normalizeScanCode(sku);
  return looksLikeBarcode(code) ? code : null;
}

type Db = SupabaseClient<Database>;

export type ProductCategoryRow = {
  id: string;
  name: string;
  sort_order: number;
};

export async function listProductCategories(
  supabase: Db,
  tenantId: string,
): Promise<ProductCategoryRow[]> {
  const { data } = await supabase
    .from("inst_product_categories")
    .select("id, name, sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export async function createProductCategory(
  supabase: Db,
  tenantId: string,
  input: { name: string; sortOrder?: number },
): Promise<ProductCategoryRow> {
  const { data, error } = await supabase
    .from("inst_product_categories")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      sort_order: input.sortOrder ?? 0,
    })
    .select("id, name, sort_order")
    .single();
  if (error || !data) throw new Error(error?.message ?? "category_create_failed");
  return data;
}

export async function updateProductCategory(
  supabase: Db,
  tenantId: string,
  id: string,
  input: { name: string; sortOrder?: number },
): Promise<void> {
  const { error } = await supabase
    .from("inst_product_categories")
    .update({ name: input.name, sort_order: input.sortOrder ?? 0 })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProductCategory(
  supabase: Db,
  tenantId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("inst_product_categories")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type InternalProductInput = {
  name: string;
  sku?: string | null;
  priceCents: number;
  stockQuantity?: number | null;
  categoryId?: string | null;
};

export async function createInternalProductRecord(
  supabase: Db,
  tenantId: string,
  input: InternalProductInput,
) {
  const categoryId = await resolveOwnedCategoryId(
    supabase,
    tenantId,
    input.categoryId,
  );
  const { data, error } = await supabase
    .from("inst_products")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      sku: input.sku ?? null,
      barcode: barcodeFromSku(input.sku),
      price_cents: input.priceCents,
      stock_quantity: input.stockQuantity ?? null,
      category_id: categoryId,
      source: "internal",
      status: "active",
    })
    .select("id, name, sku, price_cents, stock_quantity, category_id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "product_create_failed");
  return data;
}

export async function updateInternalProductRecord(
  supabase: Db,
  tenantId: string,
  id: string,
  input: InternalProductInput,
): Promise<void> {
  const categoryId = await resolveOwnedCategoryId(
    supabase,
    tenantId,
    input.categoryId,
  );
  const { error } = await supabase
    .from("inst_products")
    .update({
      name: input.name,
      sku: input.sku ?? null,
      barcode: barcodeFromSku(input.sku),
      price_cents: input.priceCents,
      stock_quantity: input.stockQuantity ?? null,
      category_id: categoryId,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("source", "internal");
  if (error) throw new Error(error.message);
}

async function resolveOwnedCategoryId(
  supabase: Db,
  tenantId: string,
  categoryId: string | null | undefined,
): Promise<string | null> {
  if (!categoryId) return null;
  const { data } = await supabase
    .from("inst_product_categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .maybeSingle();
  return data?.id ?? null;
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalId(value: unknown): string | null {
  const s = asTrimmedString(value);
  return s.length > 0 ? s : null;
}

function eurosToCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
  }
  return 0;
}

function asNonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

export function parseMobileInternalProductBody(
  raw: unknown,
): InternalProductInput | { error: "name_required" } {
  const body =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const name = asTrimmedString(body.name);
  if (!name) return { error: "name_required" };

  const priceCents =
    body.priceCents != null
      ? asNonNegativeInt(body.priceCents)
      : eurosToCents(body.price);

  const stockRaw = body.stockQuantity ?? body.stock_quantity;
  let stockQuantity: number | null = null;
  if (stockRaw !== null && stockRaw !== undefined && stockRaw !== "") {
    stockQuantity = asNonNegativeInt(stockRaw);
  }

  return {
    name,
    sku: asOptionalId(body.sku),
    priceCents,
    stockQuantity,
    categoryId: asOptionalId(body.categoryId ?? body.category_id),
  };
}

export function parseMobileProductCategoryBody(
  raw: unknown,
): { name: string; sortOrder: number } | { error: "name_required" } {
  const body =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const name = asTrimmedString(body.name);
  if (!name) return { error: "name_required" };
  return {
    name,
    sortOrder: asNonNegativeInt(body.sortOrder ?? body.sort_order),
  };
}
