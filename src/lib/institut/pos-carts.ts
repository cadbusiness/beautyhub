import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import { parsePosCart, parsePriceOverrides } from "./pos";

type Db = SupabaseClient<Database>;
type CartRow = Database["public"]["Tables"]["inst_pos_carts"]["Row"];

export const POS_CART_LOCK_MS = 90_000;
export const POS_CART_MAX_OPEN = 8;

export type PosCartStatus = "open" | "checked_out" | "abandoned";
export type PosCartDiscountKind = "percent" | "fixed";

export interface PosCartSnapshot {
  id: string;
  label: string;
  status: PosCartStatus;
  clientId: string | null;
  clientName: string | null;
  appointmentId: string | null;
  staffId: string | null;
  lines: Record<string, number>;
  priceOverrides: Record<string, number>;
  discountKind: PosCartDiscountKind | null;
  discountValue: number | null;
  discountReason: string | null;
  cartDiscountCents: number;
  notes: string | null;
  itemCount: number;
  lockedBy: string | null;
  lockedByName: string | null;
  lockedAt: string | null;
  lockedByOther: boolean;
  createdBy: string | null;
  updatedAt: string;
}

export interface PosCartWriteInput {
  label?: string | null;
  clientId?: string | null;
  appointmentId?: string | null;
  staffId?: string | null;
  lines?: Record<string, number>;
  priceOverrides?: Record<string, number>;
  discountKind?: PosCartDiscountKind | null;
  discountValue?: number | null;
  discountReason?: string | null;
  cartDiscountCents?: number;
  notes?: string | null;
}

export class PosCartError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "too_many_carts"
      | "locked"
      | "not_open"
      | "empty_cart",
  ) {
    super(message);
    this.name = "PosCartError";
  }
}

function asRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function linesFromJson(value: Json): Record<string, number> {
  try {
    return parsePosCart(JSON.stringify(asRecord(value)));
  } catch {
    return {};
  }
}

function overridesFromJson(value: Json): Record<string, number> {
  return parsePriceOverrides(JSON.stringify(asRecord(value)));
}

function itemCountOf(lines: Record<string, number>): number {
  return Object.values(lines).reduce((sum, qty) => sum + qty, 0);
}

function isLockFresh(lockedAt: string | null): boolean {
  if (!lockedAt) return false;
  const ts = Date.parse(lockedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < POS_CART_LOCK_MS;
}

function defaultLabel(index: number, clientName: string | null): string {
  const first = clientName?.trim().split(/\s+/)[0];
  if (first) return first;
  return `Panier ${index}`;
}

function serializeCart(
  row: CartRow,
  extras: {
    clientName: string | null;
    lockedByName: string | null;
    userId: string | null;
  },
): PosCartSnapshot {
  const lines = linesFromJson(row.lines);
  const lockedByOther = Boolean(
    row.locked_by &&
      extras.userId &&
      row.locked_by !== extras.userId &&
      isLockFresh(row.locked_at),
  );
  const kind =
    row.discount_kind === "percent" || row.discount_kind === "fixed"
      ? row.discount_kind
      : null;
  return {
    id: row.id,
    label: row.label,
    status: row.status as PosCartStatus,
    clientId: row.client_id,
    clientName: extras.clientName,
    appointmentId: row.appointment_id,
    staffId: row.staff_id,
    lines,
    priceOverrides: overridesFromJson(row.price_overrides),
    discountKind: kind,
    discountValue: row.discount_value,
    discountReason: row.discount_reason,
    cartDiscountCents: row.cart_discount_cents,
    notes: row.notes,
    itemCount: itemCountOf(lines),
    lockedBy: row.locked_by,
    lockedByName: extras.lockedByName,
    lockedAt: row.locked_at,
    lockedByOther,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

async function enrichCarts(
  supabase: Db,
  rows: CartRow[],
  userId: string | null,
): Promise<PosCartSnapshot[]> {
  const clientIds = [
    ...new Set(rows.map((r) => r.client_id).filter((id): id is string => !!id)),
  ];
  const lockerIds = [
    ...new Set(rows.map((r) => r.locked_by).filter((id): id is string => !!id)),
  ];

  const [clientsRes, profilesRes] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, full_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    lockerIds.length
      ? supabase
          .from("team_profiles")
          .select("user_id, full_name")
          .in("user_id", lockerIds)
      : Promise.resolve({
          data: [] as { user_id: string; full_name: string | null }[],
        }),
  ]);

  const clientNames = new Map(
    (clientsRes.data ?? []).map((c) => [c.id, c.full_name]),
  );
  const lockerNames = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]),
  );

  return rows.map((row) =>
    serializeCart(row, {
      clientName: row.client_id ? (clientNames.get(row.client_id) ?? null) : null,
      lockedByName: row.locked_by
        ? (lockerNames.get(row.locked_by) ?? null)
        : null,
      userId,
    }),
  );
}

export async function listOpenPosCarts(
  supabase: Db,
  tenantId: string,
  userId: string | null,
): Promise<PosCartSnapshot[]> {
  const { data, error } = await supabase
    .from("inst_pos_carts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrichCarts(supabase, data ?? [], userId);
}

export async function getPosCart(
  supabase: Db,
  tenantId: string,
  cartId: string,
  userId: string | null,
): Promise<PosCartSnapshot> {
  const { data, error } = await supabase
    .from("inst_pos_carts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", cartId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PosCartError("Panier introuvable.", "not_found");
  const [snapshot] = await enrichCarts(supabase, [data], userId);
  return snapshot;
}

export async function createPosCart(
  supabase: Db,
  tenantId: string,
  userId: string | null,
  input: PosCartWriteInput = {},
): Promise<PosCartSnapshot> {
  const open = await listOpenPosCarts(supabase, tenantId, userId);
  if (open.length >= POS_CART_MAX_OPEN) {
    throw new PosCartError(
      `Maximum ${POS_CART_MAX_OPEN} paniers ouverts.`,
      "too_many_carts",
    );
  }

  const lines = input.lines ?? {};
  const clientName = input.clientId
    ? ((
        await supabase
          .from("clients")
          .select("full_name")
          .eq("id", input.clientId)
          .maybeSingle()
      ).data?.full_name ?? null)
    : null;
  const label =
    input.label?.trim() || defaultLabel(open.length + 1, clientName);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("inst_pos_carts")
    .insert({
      tenant_id: tenantId,
      status: "open",
      label,
      client_id: input.clientId ?? null,
      appointment_id: input.appointmentId ?? null,
      staff_id: input.staffId ?? null,
      lines: lines as Json,
      price_overrides: (input.priceOverrides ?? {}) as Json,
      discount_kind: input.discountKind ?? null,
      discount_value: input.discountValue ?? null,
      discount_reason: input.discountReason ?? null,
      cart_discount_cents: input.cartDiscountCents ?? 0,
      notes: input.notes ?? null,
      created_by: userId,
      locked_by: userId,
      locked_at: now,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create_cart_failed");
  const [snapshot] = await enrichCarts(supabase, [data], userId);
  return snapshot;
}

export async function updatePosCart(
  supabase: Db,
  tenantId: string,
  cartId: string,
  userId: string | null,
  input: PosCartWriteInput,
  options?: { force?: boolean },
): Promise<PosCartSnapshot> {
  const current = await getPosCart(supabase, tenantId, cartId, userId);
  if (current.status !== "open") {
    throw new PosCartError("Ce panier n’est plus ouvert.", "not_open");
  }
  if (current.lockedByOther && !options?.force) {
    throw new PosCartError(
      current.lockedByName
        ? `En cours (${current.lockedByName}).`
        : "En cours sur une autre tablette.",
      "locked",
    );
  }

  const lines = input.lines ?? current.lines;
  let label = input.label?.trim() || current.label;
  if (input.clientId !== undefined && input.clientId !== current.clientId) {
    const clientName = input.clientId
      ? ((
          await supabase
            .from("clients")
            .select("full_name")
            .eq("id", input.clientId)
            .maybeSingle()
        ).data?.full_name ?? null)
      : null;
    if (clientName) label = defaultLabel(1, clientName);
    if (!input.clientId && /^[^0-9]*$/.test(current.label)) {
      label = current.label.startsWith("Panier") ? current.label : "Panier";
    }
  }

  const patch: Database["public"]["Tables"]["inst_pos_carts"]["Update"] = {
    label,
    client_id: input.clientId === undefined ? current.clientId : input.clientId,
    appointment_id:
      input.appointmentId === undefined
        ? current.appointmentId
        : input.appointmentId,
    staff_id: input.staffId === undefined ? current.staffId : input.staffId,
    lines: lines as Json,
    price_overrides: (input.priceOverrides ?? current.priceOverrides) as Json,
    discount_kind:
      input.discountKind === undefined ? current.discountKind : input.discountKind,
    discount_value:
      input.discountValue === undefined
        ? current.discountValue
        : input.discountValue,
    discount_reason:
      input.discountReason === undefined
        ? current.discountReason
        : input.discountReason,
    cart_discount_cents:
      input.cartDiscountCents === undefined
        ? current.cartDiscountCents
        : input.cartDiscountCents,
    notes: input.notes === undefined ? current.notes : input.notes,
    locked_by: userId,
    locked_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("inst_pos_carts")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", cartId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "update_cart_failed");
  const [snapshot] = await enrichCarts(supabase, [data], userId);
  return snapshot;
}

export async function claimPosCart(
  supabase: Db,
  tenantId: string,
  cartId: string,
  userId: string | null,
  options?: { force?: boolean },
): Promise<PosCartSnapshot> {
  const current = await getPosCart(supabase, tenantId, cartId, userId);
  if (current.status !== "open") {
    throw new PosCartError("Ce panier n’est plus ouvert.", "not_open");
  }
  if (current.lockedByOther && !options?.force) {
    throw new PosCartError(
      current.lockedByName
        ? `En cours (${current.lockedByName}).`
        : "En cours sur une autre tablette.",
      "locked",
    );
  }
  const { data, error } = await supabase
    .from("inst_pos_carts")
    .update({
      locked_by: userId,
      locked_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", cartId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "claim_cart_failed");
  const [snapshot] = await enrichCarts(supabase, [data], userId);
  return snapshot;
}

export async function abandonPosCart(
  supabase: Db,
  tenantId: string,
  cartId: string,
  userId: string | null,
  options?: { force?: boolean },
): Promise<void> {
  const current = await getPosCart(supabase, tenantId, cartId, userId);
  if (current.status !== "open") return;
  if (current.lockedByOther && !options?.force) {
    throw new PosCartError(
      current.lockedByName
        ? `En cours (${current.lockedByName}).`
        : "En cours sur une autre tablette.",
      "locked",
    );
  }
  const { error } = await supabase
    .from("inst_pos_carts")
    .update({ status: "abandoned", locked_by: null, locked_at: null })
    .eq("tenant_id", tenantId)
    .eq("id", cartId);
  if (error) throw new Error(error.message);
}

export async function markPosCartCheckedOut(
  supabase: Db,
  tenantId: string,
  cartId: string,
): Promise<void> {
  const { error } = await supabase
    .from("inst_pos_carts")
    .update({ status: "checked_out", locked_by: null, locked_at: null })
    .eq("tenant_id", tenantId)
    .eq("id", cartId)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}

export async function ensureActivePosCart(
  supabase: Db,
  tenantId: string,
  userId: string | null,
): Promise<{ carts: PosCartSnapshot[]; active: PosCartSnapshot }> {
  const carts = await listOpenPosCarts(supabase, tenantId, userId);
  if (carts.length === 0) {
    const created = await createPosCart(supabase, tenantId, userId);
    return { carts: [created], active: created };
  }
  const mine = carts.find((c) => c.lockedBy === userId && !c.lockedByOther);
  const active = mine ?? carts.find((c) => !c.lockedByOther) ?? carts[0];
  if (!active.lockedByOther) {
    const claimed = await claimPosCart(supabase, tenantId, active.id, userId);
    const next = await listOpenPosCarts(supabase, tenantId, userId);
    return { carts: next, active: claimed };
  }
  return { carts, active };
}
