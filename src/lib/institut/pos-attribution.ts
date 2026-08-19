const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Map panier `service:uuid` → `inst_staff.id`. */
export function parseLineStaff(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && isUuid(value)) out[key] = value;
  }
  return out;
}

export function pruneLineStaff(
  lineStaff: Record<string, string>,
  cartKeys: Iterable<string>,
): Record<string, string> {
  const keep = new Set(cartKeys);
  const out: Record<string, string> = {};
  for (const [key, staffId] of Object.entries(lineStaff)) {
    if (keep.has(key)) out[key] = staffId;
  }
  return out;
}

export function resolveLineStaffId(
  lineKey: string,
  lineStaff: Record<string, string>,
  cartStaffId: string | null | undefined,
): string | null {
  return lineStaff[lineKey] ?? cartStaffId ?? null;
}

export function assertServiceStaffAssigned(
  lines: Array<{ key: string; type: "service" | "product" }>,
  lineStaff: Record<string, string>,
  cartStaffId: string | null | undefined,
): void {
  for (const line of lines) {
    if (line.type !== "service") continue;
    if (!resolveLineStaffId(line.key, lineStaff, cartStaffId)) {
      throw new Error("staff_required_for_service");
    }
  }
}

/** Praticien principal du ticket : plus gros CA de prestations, sinon le ticket. */
export function primaryStaffId(
  lines: Array<{
    key: string;
    type: "service" | "product";
    line_total_cents: number;
  }>,
  lineStaff: Record<string, string>,
  cartStaffId: string | null | undefined,
): string | null {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.type !== "service") continue;
    const staffId = resolveLineStaffId(line.key, lineStaff, cartStaffId);
    if (!staffId) continue;
    totals.set(staffId, (totals.get(staffId) ?? 0) + line.line_total_cents);
  }
  let best: string | null = null;
  let bestAmount = -1;
  for (const [staffId, amount] of totals) {
    if (amount > bestAmount) {
      best = staffId;
      bestAmount = amount;
    }
  }
  return best ?? cartStaffId ?? null;
}
