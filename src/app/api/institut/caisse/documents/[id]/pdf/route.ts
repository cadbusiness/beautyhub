import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadSaleDocumentPayload } from "@/lib/institut/sale-documents/load";
import {
  renderTicketPdfBuffer,
  ticketPdfFileName,
  ticketPdfHeaders,
} from "@/lib/institut/sale-documents/ticket-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireModule("institut");
  const supabase = await createClient();

  const payload = await loadSaleDocumentPayload(
    supabase,
    session.tenant.id,
    id,
    session.tenant.name,
  );
  if (!payload) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const bytes = await renderTicketPdfBuffer(payload);
  return new NextResponse(new Uint8Array(bytes), {
    headers: ticketPdfHeaders(ticketPdfFileName(payload)),
  });
}
