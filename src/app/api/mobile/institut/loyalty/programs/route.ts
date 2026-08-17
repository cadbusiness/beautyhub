import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { createLoyaltyProgramRecord } from "@/lib/institut/loyalty-admin";
import { loyaltyAdminHttp } from "@/lib/institut/mobile-loyalty-json";

const bodySchema = z.object({
  name: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "missing_fields", message: "Nom du programme requis." },
        { status: 400 },
      );
    }
    const created = await createLoyaltyProgramRecord(
      session.supabase,
      session.tenant.id,
      parsed.data.name,
    );
    return Response.json({ ok: true, programId: created.programId });
  } catch (error) {
    if (error instanceof Error && error.name === "LoyaltyAdminError") {
      return loyaltyAdminHttp(error);
    }
    return mobileErrorResponse(error);
  }
}
