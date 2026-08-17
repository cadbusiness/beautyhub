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
  MOBILE_CLIENT_SELECT,
} from "@/lib/institut/mobile-clients";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

/**
 * GET /api/mobile/institut/clients
 * Liste paginée + recherche pour l'app mobile.
 * ?q=texte&limit=60&cursor=<created_at ISO>
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(
      url.searchParams.get("limit") ?? String(DEFAULT_LIMIT),
      10,
    );
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const cursor = url.searchParams.get("cursor");

    let query = session.supabase
      .from("clients")
      .select(MOBILE_CLIENT_SELECT)
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (q.length >= 1) {
      const pattern = q.replace(/[%_,\\]/g, " ").replace(/,/g, " ").trim();
      if (pattern) {
        const like = `%${pattern}%`;
        query = query.or(
          `full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
        );
      }
    }
    if (cursor) {
      query = query.lt("created_at", cursor);
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
    const nextCursor = hasMore ? rows[limit - 1].created_at : null;

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
