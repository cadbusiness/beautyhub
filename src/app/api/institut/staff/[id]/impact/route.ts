import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireInstitutApi(request);
    const supabase = await createClient();

    const { data: staff, error: staffErr } = await supabase
      .from("inst_staff")
      .select("id, user_id, email, full_name, is_active, archived_at")
      .eq("tenant_id", session.tenant.id)
      .eq("id", id)
      .maybeSingle();
    if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 500 });
    if (!staff) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const nowIso = new Date().toISOString();

    const [
      { count: upcomingCount, error: upcomingErr },
      { count: pastCount, error: pastErr },
      { count: salesCount, error: salesErr },
      { count: pendingInvites, error: inviteErr },
    ] = await Promise.all([
      supabase
        .from("inst_appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("staff_id", id)
        .gt("starts_at", nowIso)
        .in("status", ["booked", "confirmed"]),
      supabase
        .from("inst_appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("staff_id", id)
        .lte("starts_at", nowIso),
      supabase
        .from("inst_sales")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("staff_id", id),
      supabase
        .from("team_invitations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("staff_id", id)
        .eq("status", "pending"),
    ]);
    if (upcomingErr) return NextResponse.json({ error: upcomingErr.message }, { status: 500 });
    if (pastErr) return NextResponse.json({ error: pastErr.message }, { status: 500 });
    if (salesErr) return NextResponse.json({ error: salesErr.message }, { status: 500 });
    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });

    let hasMembership = false;
    if (staff.user_id) {
      const { count: memCount } = await supabase
        .from("memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("user_id", staff.user_id);
      hasMembership = (memCount ?? 0) > 0;
    }

    let accessStatus: "active" | "pending" | "none" = "none";
    if (hasMembership) accessStatus = "active";
    else if ((pendingInvites ?? 0) > 0) accessStatus = "pending";

    const totalAppointments = (upcomingCount ?? 0) + (pastCount ?? 0);
    const canHardDelete = totalAppointments === 0 && (salesCount ?? 0) === 0;

    const { data: activeStaff, error: staffListErr } = await supabase
      .from("inst_staff")
      .select("id, full_name, color")
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .neq("id", id)
      .order("full_name", { ascending: true });
    if (staffListErr) return NextResponse.json({ error: staffListErr.message }, { status: 500 });

    return NextResponse.json({
      staff: {
        id: staff.id,
        full_name: staff.full_name,
        is_active: staff.is_active,
        archived_at: staff.archived_at,
      },
      upcomingAppointments: upcomingCount ?? 0,
      pastAppointments: pastCount ?? 0,
      sales: salesCount ?? 0,
      accessStatus,
      canHardDelete,
      otherActiveStaff: activeStaff ?? [],
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[staff-impact]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
