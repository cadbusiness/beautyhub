import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  loadTenantProfile,
  saveDefaultOpeningHours,
  saveTenantPublicProfile,
} from "@/lib/institut/tenant-profile";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

const contactSchema = z.object({
  email: z
    .string()
    .trim()
    .max(180)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null))
    .refine(
      (value) => value === undefined || value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "invalid_email",
    ),
  phone: optionalText,
  website: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
});

const addressSchema = z.object({
  line1: optionalText,
  line2: optionalText,
  city: optionalText,
  postalCode: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
  country: optionalText,
});

const slotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const patchSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
  contact: contactSchema.optional(),
  address: addressSchema.optional(),
  openingHours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        slots: z.array(slotSchema).max(4),
      }),
    )
    .min(1)
    .max(7)
    .optional(),
});

/**
 * GET /api/mobile/institut/tenant
 * Infos publiques de l'institut : identité, contact, horaires.
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const profile = await loadTenantProfile(session.supabase, session.tenant.id);
    if (!profile) {
      return Response.json(
        { error: "tenant_not_found", message: "Institut introuvable." },
        { status: 404 },
      );
    }
    return Response.json(profile);
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

/**
 * PATCH /api/mobile/institut/tenant
 * Met à jour le nom public, le contact, l'adresse et/ou les horaires.
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
    }

    const { displayName, description, contact, address, openingHours } = parsed.data;
    if (
      displayName === undefined &&
      description === undefined &&
      contact === undefined &&
      address === undefined &&
      openingHours === undefined
    ) {
      return Response.json(
        { error: "empty_patch", message: "Aucune modification." },
        { status: 400 },
      );
    }

    if (
      displayName !== undefined ||
      description !== undefined ||
      contact !== undefined ||
      address !== undefined
    ) {
      const saved = await saveTenantPublicProfile(session.supabase, session.tenant.id, {
        displayName,
        description,
        contact,
        address,
      });
      if (saved.error) {
        return Response.json(
          { error: "save_failed", message: saved.error },
          { status: 500 },
        );
      }
    }

    if (openingHours) {
      const hours = await saveDefaultOpeningHours(
        session.supabase,
        session.tenant.id,
        openingHours,
      );
      if (hours.error) {
        const message =
          hours.error === "end_before_start"
            ? "L’heure de fin doit être après l’heure de début."
            : hours.error === "invalid_time" || hours.error === "invalid_hours"
              ? "Horaires invalides."
              : hours.error;
        return Response.json({ error: hours.error, message }, { status: 400 });
      }
    }

    const profile = await loadTenantProfile(session.supabase, session.tenant.id);
    if (!profile) {
      return Response.json(
        { error: "tenant_not_found", message: "Institut introuvable." },
        { status: 404 },
      );
    }
    return Response.json(profile);
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
