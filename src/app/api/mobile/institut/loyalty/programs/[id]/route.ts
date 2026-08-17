import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  duplicateLoyaltyProgramRecord,
  saveLoyaltyProgramSettingsRecord,
  setLoyaltyProgramActiveRecord,
} from "@/lib/institut/loyalty-admin";
import { loyaltyAdminHttp } from "@/lib/institut/mobile-loyalty-json";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  pointsLabel: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  birthdayBonusPoints: z.number().int().min(0).optional(),
  birthdayAutoEnabled: z.boolean().optional(),
  portalVisible: z.boolean().optional(),
  referralPoints: z.number().int().min(0).optional(),
  sameDayRebookPoints: z.number().int().min(0).optional(),
  creditEnabled: z.boolean().optional(),
  creditRateBps: z.number().int().min(0).max(10000).optional(),
});

const duplicateSchema = z.object({
  action: z.literal("duplicate"),
  name: z.string().trim().min(1),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Paramètres invalides." },
        { status: 400 },
      );
    }
    const data = parsed.data;
    if (data.name != null && data.pointsLabel != null) {
      await saveLoyaltyProgramSettingsRecord(session.supabase, session.tenant.id, {
        programId: id,
        name: data.name,
        pointsLabel: data.pointsLabel,
        isActive: data.isActive ?? false,
        birthdayBonusPoints: data.birthdayBonusPoints ?? 0,
        birthdayAutoEnabled: data.birthdayAutoEnabled ?? false,
        portalVisible: data.portalVisible ?? true,
        referralPoints: data.referralPoints ?? 0,
        sameDayRebookPoints: data.sameDayRebookPoints ?? 0,
        creditEnabled: data.creditEnabled ?? false,
        creditRateBps: data.creditRateBps ?? 0,
      });
    } else if (data.isActive != null) {
      await setLoyaltyProgramActiveRecord(
        session.supabase,
        session.tenant.id,
        id,
        data.isActive,
      );
    } else {
      return Response.json(
        { error: "invalid_body", message: "Rien à enregistrer." },
        { status: 400 },
      );
    }
    return Response.json({ ok: true, programId: id });
  } catch (error) {
    const mapped = loyaltyAdminHttp(error);
    if (mapped.status !== 500 || error instanceof Error && error.name === "LoyaltyAdminError") {
      return mapped;
    }
    return mobileErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const parsed = duplicateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "missing_fields", message: "Nom du programme requis." },
        { status: 400 },
      );
    }
    const created = await duplicateLoyaltyProgramRecord(
      session.supabase,
      session.tenant.id,
      id,
      parsed.data.name,
    );
    return Response.json({ ok: true, programId: created.programId });
  } catch (error) {
    const mapped = loyaltyAdminHttp(error);
    if (mapped.status !== 500) return mapped;
    return mobileErrorResponse(error);
  }
}
