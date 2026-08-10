import {
  listAccessibleTenantsForUser,
  mobileErrorResponse,
  requireMobileAuth,
} from "@/lib/mobile/session";

export async function GET(request: Request) {
  try {
    const auth = await requireMobileAuth(request);
    const tenants = await listAccessibleTenantsForUser(
      auth.supabase,
      auth.user.id,
    );
    return Response.json({
      tenants,
      user: {
        id: auth.user.id,
        email: auth.user.email ?? null,
      },
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
