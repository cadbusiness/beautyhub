import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/compliance/audit";
import {
  clientExportFilename,
  exportClientData,
  serializeClientExport,
} from "@/lib/compliance/export";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireModule("institut");
    const user = await getCurrentUser();
    const supabase = await createClient();

    const data = await exportClientData(supabase, session.tenant.id, id);
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await logAuditEvent(supabase, {
      tenantId: session.tenant.id,
      actorType: "team",
      actorId: user?.id,
      actorEmail: user?.email,
      action: "client.data_export",
      resourceType: "client",
      resourceId: id,
    });

    const json = serializeClientExport(data);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${clientExportFilename(id)}"`,
      },
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[client-export]", error);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
