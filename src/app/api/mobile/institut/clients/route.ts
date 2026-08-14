import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";

interface CreateClientPayload {
  email?: unknown;
  fullName?: unknown;
  phone?: unknown;
  marketingOptIn?: unknown;
  notes?: unknown;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * POST /api/mobile/institut/clients
 * Créé une fiche client minimale depuis l'app mobile (POS ou agenda).
 * Retourne la ligne complète pour être injectée dans un picker.
 */
export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const raw = (await request.json().catch(() => ({}))) as CreateClientPayload;

    const email = normalizeEmail(raw.email);
    const fullName = normalizeText(raw.fullName);
    const phone = normalizeText(raw.phone);
    const notes = normalizeText(raw.notes);
    const marketingOptIn = raw.marketingOptIn === true;

    if (!email && !fullName && !phone) {
      return Response.json(
        { error: "missing_fields", message: "Nom, email ou téléphone requis." },
        { status: 400 },
      );
    }
    if (email && !email.includes("@")) {
      return Response.json(
        { error: "invalid_email", message: "Email invalide." },
        { status: 400 },
      );
    }

    // Placeholder email quand pas fourni (walk-in / téléphone only).
    // Format stable pour éviter les collisions et rester rétro-compatible.
    const effectiveEmail =
      email || `noemail+${crypto.randomUUID()}@beautyhub.local`;

    const insertPayload: Record<string, unknown> = {
      tenant_id: session.tenant.id,
      email: effectiveEmail,
      full_name: fullName,
      phone,
      marketing_opt_in: marketingOptIn,
      source: "manual",
    };
    if (notes) {
      insertPayload.metadata = { notes };
    }

    const { data, error } = await session.supabase
      .from("clients")
      .insert(insertPayload)
      .select("id, full_name, email, phone")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        return Response.json(
          {
            error: "email_exists",
            message: "Une cliente avec cet email existe déjà.",
          },
          { status: 409 },
        );
      }
      return Response.json(
        {
          error: "insert_failed",
          message: error?.message ?? "Création impossible.",
        },
        { status: 500 },
      );
    }

    const displayEmail = data.email?.endsWith("@beautyhub.local")
      ? null
      : data.email;
    const label = data.full_name
      ? displayEmail
        ? `${data.full_name} (${displayEmail})`
        : data.full_name
      : (displayEmail ?? data.phone ?? "Cliente");

    return Response.json(
      {
        client: {
          id: data.id,
          label,
          fullName: data.full_name,
          email: displayEmail,
          phone: data.phone,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
