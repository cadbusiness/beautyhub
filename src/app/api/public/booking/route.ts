import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/context";
import {
  fetchPublicServiceExtras,
  fetchPublicSlots,
  fetchPublicStaff,
} from "@/lib/public/booking-load";
import type { BookingExtraLine } from "@/lib/institut/service-extras";

function parseExtrasParam(raw: string | null): BookingExtraLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is BookingExtraLine =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as BookingExtraLine).service_id === "string" &&
        typeof (e as BookingExtraLine).quantity === "number",
    );
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const tenant = await getTenantContext();
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId required" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const date = url.searchParams.get("date");
    if (date) {
      const staffId = url.searchParams.get("staffId") ?? undefined;
      const extras = parseExtrasParam(url.searchParams.get("extras"));
      const slots = await fetchPublicSlots(
        supabase,
        tenant.id,
        serviceId,
        date,
        staffId,
        extras,
      );
      return NextResponse.json(slots);
    }

    const kind = url.searchParams.get("kind") ?? "staff";
    if (kind === "extras") {
      const catalog = await fetchPublicServiceExtras(supabase, tenant.id, serviceId);
      return NextResponse.json(catalog);
    }

    const staff = await fetchPublicStaff(supabase, tenant.id, serviceId);
    return NextResponse.json(staff);
  } catch (error) {
    console.error("[public/booking]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
