import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { fetchTenantBranding } from "@/lib/institut/tenant-branding";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const branding = await fetchTenantBranding(
      session.supabase,
      session.tenant.id,
      session.tenant.name,
    );

    return Response.json({
      displayName: branding.displayName,
      primaryColor: branding.primaryColor,
      logoUrl: branding.logoUrl,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
