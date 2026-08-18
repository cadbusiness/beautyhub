import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  clientPickerLabel,
  createMobileClient,
  parseMobileClientBody,
  serializeMobileClient,
  type MobileClientRow,
  MOBILE_CLIENT_LIST_SELECT,
} from "@/lib/institut/mobile-clients";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;

function parseFromLetter(raw: string | null): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "#" || value === "~") return "#";
  if (/^[a-z]$/.test(value)) return value;
  return null;
}

/**
 * GET /api/mobile/institut/clients
 * Liste paginée alphabétique (nom de famille) + recherche.
 * ?q=texte&from=m&limit=60&cursor=<offset>
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const fromLetter = parseFromLetter(url.searchParams.get("from"));
    const limitRaw = Number.parseInt(
      url.searchParams.get("limit") ?? String(DEFAULT_LIMIT),
      10,
    );
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const cursor = url.searchParams.get("cursor");

    const offset = /^\d+$/.test(cursor ?? "")
      ? Number.parseInt(cursor as string, 10)
      : 0;

    let query = session.supabase
      .from("clients")
      .select(MOBILE_CLIENT_LIST_SELECT)
      .eq("tenant_id", session.tenant.id)
      .order("last_name_sort", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit);

    if (q.length >= 1) {
      const pattern = q.replace(/[%_,\\]/g, " ").replace(/,/g, " ").trim();
      if (pattern) {
        const like = `%${pattern}%`;
        query = query.or(
          `full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
        );
      }
    } else if (fromLetter === "#") {
      query = query.or("last_name_sort.lt.a,last_name_sort.gte.~");
    } else if (fromLetter) {
      query = query.gte("last_name_sort", fromLetter);
    }

    const { data, error } = await query;
    if (error) {
      return Response.json(
        { error: "fetch_failed", message: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as MobileClientRow[];
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(serializeMobileClient);
    const nextCursor = hasMore ? String(offset + limit) : null;

    return Response.json({ items, nextCursor });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

/**
 * POST /api/mobile/institut/clients
 * Crée une fiche cliente depuis l'app (liste, POS ou agenda).
 */
export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const raw = await request.json().catch(() => ({}));
    const result = await createMobileClient(
      session.supabase,
      session.tenant.id,
      session.user.id,
      parseMobileClientBody(raw),
    );

    if ("error" in result) {
      return Response.json(
        { error: result.code, message: result.error },
        { status: result.status },
      );
    }

    return Response.json(
      {
        item: result.item,
        client: {
          id: result.item.id,
          label: clientPickerLabel(result.item),
          fullName: result.item.fullName,
          email: result.item.email,
          phone: result.item.phone,
          marketingOptIn: result.item.marketingOptIn,
        },
        account: result.account,
      },
      { status: 201 },
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
