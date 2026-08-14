import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";

/**
 * GET /api/mobile/institut/team
 * Liste des praticiennes/staff de l'institut avec métadonnées visuelles.
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });

    const { data, error } = await session.supabase
      .from("inst_staff")
      .select(
        "id, full_name, email, avatar_url, color, is_active, schedule_id, user_id, created_at",
      )
      .eq("tenant_id", session.tenant.id)
      .order("is_active", { ascending: false })
      .order("full_name", { ascending: true });

    if (error) {
      return Response.json(
        { error: "fetch_failed", message: error.message },
        { status: 500 },
      );
    }

    const items = (data ?? []).map((s) => ({
      id: s.id,
      fullName: s.full_name,
      email: s.email,
      avatarUrl: s.avatar_url,
      color: s.color,
      isActive: s.is_active,
      hasSchedule: !!s.schedule_id,
      hasAccount: !!s.user_id,
      createdAt: s.created_at,
    }));

    return Response.json({ items });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
