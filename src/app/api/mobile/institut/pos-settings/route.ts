import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  getPosSettings,
  serializePosFiscalSettings,
  updatePosFiscalSettings,
} from "@/lib/institut/pos-settings";

const patchSchema = z.object({
  countryCode: z.string().optional(),
  currency: z.string().optional(),
  fiscalRegime: z.string().optional(),
  priceDisplay: z.enum(["ttc", "ht"]).optional(),
  defaultVatRateBps: z.number().int().min(0).max(10000).optional(),
  serviceVatRateBps: z.number().int().min(0).max(10000).optional(),
  productVatRateBps: z.number().int().min(0).max(10000).optional(),
  legalName: z.string().nullable().optional(),
  legalAddress: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  ticketHeader: z.string().nullable().optional(),
  ticketFooter: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const settings = await getPosSettings(session.supabase, session.tenant.id);
    return Response.json(serializePosFiscalSettings(settings));
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Paramètres fiscaux invalides." },
        { status: 400 },
      );
    }
    const settings = await updatePosFiscalSettings(
      session.supabase,
      session.tenant.id,
      parsed.data,
    );
    return Response.json(serializePosFiscalSettings(settings));
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
