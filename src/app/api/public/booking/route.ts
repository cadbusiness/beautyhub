import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/context";
import {
  fetchPublicSlotsMatchingAvailability,
  isAvailabilityValid,
  type AvailabilityPreferences,
} from "@/lib/public/booking-availability";
import {
  fetchPublicServiceExtras,
  fetchPublicSlots,
  fetchPublicStaff,
} from "@/lib/public/booking-load";
import type { BookingExtraLine } from "@/lib/institut/service-extras";

function parseWeekdaysParam(raw: string | null): number[] {
  if (!raw) return [0, 1, 2, 3, 4, 5, 6];
  return raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function parseAvailabilityParams(url: URL): AvailabilityPreferences | null {
  const fromDate = url.searchParams.get("fromDate");
  if (!fromDate) return null;
  const prefs: AvailabilityPreferences = {
    fromDate,
    weekdays: parseWeekdaysParam(url.searchParams.get("weekdays")),
    timeFrom: url.searchParams.get("timeFrom") ?? "09:00",
    timeTo: url.searchParams.get("timeTo") ?? "18:00",
  };
  return isAvailabilityValid(prefs) ? prefs : null;
}

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
    const staffId = url.searchParams.get("staffId") ?? undefined;
    const extras = parseExtrasParam(url.searchParams.get("extras"));
    const availability = parseAvailabilityParams(url);

    if (availability) {
      if (!staffId) {
        return NextResponse.json({ error: "staffId required" }, { status: 400 });
      }
      const slots = await fetchPublicSlotsMatchingAvailability(
        supabase,
        tenant.id,
        serviceId,
        staffId,
        extras,
        availability,
      );
      return NextResponse.json(slots);
    }

    const date = url.searchParams.get("date");
    if (date) {
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
