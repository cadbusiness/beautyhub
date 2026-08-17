import { NextResponse } from "next/server";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { loadTicketPayloadBySaleId } from "@/lib/institut/sale-documents/load";
import {
  renderTicketPdfBuffer,
  ticketPdfFileName,
  ticketPdfHeaders,
} from "@/lib/institut/sale-documents/ticket-pdf";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;

    const payload = await loadTicketPayloadBySaleId(
      session.supabase,
      session.tenant.id,
      id,
      session.tenant.name,
    );
    if (!payload) {
      return NextResponse.json(
        { error: "not_found", message: "Ticket introuvable" },
        { status: 404 },
      );
    }

    const bytes = await renderTicketPdfBuffer(payload);
    return new NextResponse(new Uint8Array(bytes), {
      headers: ticketPdfHeaders(ticketPdfFileName(payload)),
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
