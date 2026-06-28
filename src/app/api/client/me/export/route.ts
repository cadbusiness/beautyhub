import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant/context";
import { getClientSession } from "@/lib/client-auth/session";
import { logAuditEvent } from "@/lib/compliance/audit";
import {
  clientExportFilename,
  exportClientData,
  serializeClientExport,
} from "@/lib/compliance/export";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
    }

    const session = await getClientSession(tenant.id);
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      return NextResponse.json({ error: "server_config" }, { status: 503 });
    }

    const data = await exportClientData(
      supabase,
      tenant.id,
      session.clientId,
    );
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await logAuditEvent(supabase, {
      tenantId: tenant.id,
      actorType: "client",
      actorId: session.clientId,
      actorEmail: session.email,
      action: "client.self_export",
      resourceType: "client",
      resourceId: session.clientId,
    });

    const json = serializeClientExport(data);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${clientExportFilename(session.clientId)}"`,
      },
    });
  } catch (error) {
    console.error("[client-self-export]", error);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
