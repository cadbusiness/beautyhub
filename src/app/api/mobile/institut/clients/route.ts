import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { provisionClientAccess } from "@/lib/institut/client-access";
import type { Database } from "@/lib/db/database.types";

type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

interface CreateClientPayload {
  email?: unknown;
  fullName?: unknown;
  phone?: unknown;
  marketingOptIn?: unknown;
  createAccount?: unknown;
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
 * Peut aussi provisionner un compte cliente (login_id + PIN).
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
    const createAccount = raw.createAccount === true;

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
    if (createAccount && !email) {
      return Response.json(
        {
          error: "email_required_for_account",
          message: "Email requis pour créer un compte cliente.",
        },
        { status: 400 },
      );
    }

    // Placeholder email quand pas fourni (walk-in / téléphone only).
    const effectiveEmail =
      email || `noemail+${crypto.randomUUID()}@beautyhub.local`;

    const insertPayload: ClientInsert = {
      tenant_id: session.tenant.id,
      email: effectiveEmail,
      full_name: fullName,
      phone,
      marketing_opt_in: marketingOptIn,
      source: "manual",
    };
    if (notes) {
      insertPayload.metadata = { notes } as ClientInsert["metadata"];
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

    let account: { loginId: string; pinCode: string } | null = null;
    if (createAccount) {
      try {
        account = await provisionClientAccess(
          session.supabase,
          session.tenant.id,
          data.id,
        );
      } catch (e) {
        // Ne bloque pas la création client, on retourne juste sans account.
        console.error("[mobile/clients] provisionClientAccess failed", e);
      }
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
          marketingOptIn,
        },
        account,
      },
      { status: 201 },
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
