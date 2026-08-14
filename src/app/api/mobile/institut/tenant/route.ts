import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  fetchPublicOpeningHours,
  groupOpeningHoursByWeekday,
  formatTimeLabel,
} from "@/lib/institut/opening-hours";

/**
 * GET /api/mobile/institut/tenant
 * Infos publiques de l'institut : identité, contact, horaires.
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });

    const [tenantRes, hoursRows, staffCountRes, servicesCountRes, clientsCountRes] =
      await Promise.all([
        session.supabase
          .from("tenants")
          .select("id, name, slug, branding, custom_domain, created_at")
          .eq("id", session.tenant.id)
          .maybeSingle(),
        fetchPublicOpeningHours(session.supabase, session.tenant.id),
        session.supabase
          .from("inst_staff")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", session.tenant.id)
          .eq("is_active", true),
        session.supabase
          .from("inst_services")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", session.tenant.id)
          .eq("is_active", true),
        session.supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", session.tenant.id),
      ]);

    if (tenantRes.error || !tenantRes.data) {
      return Response.json(
        {
          error: "tenant_not_found",
          message: tenantRes.error?.message ?? "Institut introuvable.",
        },
        { status: 404 },
      );
    }

    const branding = (tenantRes.data.branding as Record<string, unknown>) ?? {};
    const contact = (branding.contact as Record<string, unknown>) ?? {};
    const address = (branding.address as Record<string, unknown>) ?? {};

    const grouped = groupOpeningHoursByWeekday(hoursRows);
    const weekdayLabels = [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ];
    const openingHours = Array.from({ length: 7 }, (_, i) => {
      const slots = (grouped.get(i) ?? []).map((r) => ({
        start: formatTimeLabel(r.start_time),
        end: formatTimeLabel(r.end_time),
      }));
      return {
        weekday: i,
        label: weekdayLabels[i],
        slots,
      };
    });

    return Response.json({
      id: tenantRes.data.id,
      name: tenantRes.data.name,
      slug: tenantRes.data.slug,
      customDomain: tenantRes.data.custom_domain,
      displayName: (branding.displayName as string | undefined) ?? tenantRes.data.name,
      primaryColor: (branding.primaryColor as string | undefined) ?? null,
      logoUrl: (branding.logoUrl as string | undefined) ?? null,
      description: (branding.description as string | undefined) ?? null,
      contact: {
        email: (contact.email as string | undefined) ?? null,
        phone: (contact.phone as string | undefined) ?? null,
        website: (contact.website as string | undefined) ?? null,
      },
      address: {
        line1: (address.line1 as string | undefined) ?? null,
        line2: (address.line2 as string | undefined) ?? null,
        city: (address.city as string | undefined) ?? null,
        postalCode: (address.postalCode as string | undefined) ?? null,
        country: (address.country as string | undefined) ?? null,
      },
      openingHours,
      counts: {
        activeStaff: staffCountRes.count ?? 0,
        activeServices: servicesCountRes.count ?? 0,
        clients: clientsCountRes.count ?? 0,
      },
      createdAt: tenantRes.data.created_at,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
