import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import { parseBlocksJson, type ScheduleBlock } from "@/lib/institut/schedules";
import { parseSiteBlocks } from "@/lib/institut/site-pages";
import { ensureSiteSettings } from "@/lib/institut/site-settings";
import {
  fetchPublicOpeningHours,
  formatTimeLabel,
  groupOpeningHoursByWeekday,
} from "@/lib/institut/opening-hours";

type Db = SupabaseClient<Database>;

const WEEKDAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export type TenantContactInput = {
  email: string | null;
  phone: string | null;
  website: string | null;
};

export type TenantAddressInput = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
};

export type TenantOpeningSlot = { start: string; end: string };

export type TenantOpeningDay = {
  weekday: number;
  label: string;
  slots: TenantOpeningSlot[];
};

export type TenantProfileSnapshot = {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  displayName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  description: string | null;
  contact: TenantContactInput;
  address: TenantAddressInput;
  openingHours: TenantOpeningDay[];
  counts: {
    activeStaff: number;
    activeServices: number;
    clients: number;
  };
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readContact(branding: Record<string, unknown>): TenantContactInput {
  const contact = asRecord(branding.contact);
  return {
    email: asString(contact.email),
    phone: asString(contact.phone),
    website: asString(contact.website),
  };
}

function readAddress(branding: Record<string, unknown>): TenantAddressInput {
  const address = asRecord(branding.address);
  return {
    line1: asString(address.line1),
    line2: asString(address.line2),
    city: asString(address.city),
    postalCode: asString(address.postalCode),
    country: asString(address.country),
  };
}

export function formatAddressOneLine(address: TenantAddressInput): string {
  const parts: string[] = [];
  if (address.line1) parts.push(address.line1);
  if (address.line2) parts.push(address.line2);
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  if (cityLine) parts.push(cityLine);
  if (address.country) parts.push(address.country);
  return parts.join(", ");
}

function openingHoursFromRows(
  rows: Awaited<ReturnType<typeof fetchPublicOpeningHours>>,
): TenantOpeningDay[] {
  const grouped = groupOpeningHoursByWeekday(rows);
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    slots: (grouped.get(weekday) ?? []).map((row) => ({
      start: formatTimeLabel(row.start_time),
      end: formatTimeLabel(row.end_time),
    })),
  }));
}

export async function loadTenantProfile(
  supabase: Db,
  tenantId: string,
): Promise<TenantProfileSnapshot | null> {
  const [
    tenantRes,
    settingsRes,
    hoursRows,
    staffCountRes,
    servicesCountRes,
    clientsCountRes,
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, branding, custom_domain, created_at")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("inst_site_settings")
      .select("display_name, primary_color, logo_url")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    fetchPublicOpeningHours(supabase, tenantId),
    supabase
      .from("inst_staff")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("inst_services")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  if (tenantRes.error || !tenantRes.data) return null;

  const branding = asRecord(tenantRes.data.branding);
  const contact = readContact(branding);
  const address = readAddress(branding);
  const settings = settingsRes.data;

  return {
    id: tenantRes.data.id,
    name: tenantRes.data.name,
    slug: tenantRes.data.slug,
    customDomain: tenantRes.data.custom_domain,
    displayName:
      settings?.display_name?.trim() ||
      asString(branding.displayName) ||
      tenantRes.data.name,
    primaryColor:
      settings?.primary_color || asString(branding.primaryColor),
    logoUrl: settings?.logo_url || asString(branding.logoUrl),
    description: asString(branding.description),
    contact,
    address,
    openingHours: openingHoursFromRows(hoursRows),
    counts: {
      activeStaff: staffCountRes.count ?? 0,
      activeServices: servicesCountRes.count ?? 0,
      clients: clientsCountRes.count ?? 0,
    },
    createdAt: tenantRes.data.created_at,
  };
}

async function syncSiteContactBlocks(
  supabase: Db,
  tenantId: string,
  contact: TenantContactInput,
  address: TenantAddressInput,
): Promise<void> {
  const { data: pages } = await supabase
    .from("inst_site_pages")
    .select("id, content")
    .eq("tenant_id", tenantId);
  if (!pages?.length) return;

  const formattedAddress = formatAddressOneLine(address);
  await Promise.all(
    pages.map(async (page) => {
      const blocks = parseSiteBlocks(page.content);
      let changed = false;
      const next = blocks.map((block) => {
        if (block.type !== "contact") return block;
        changed = true;
        return {
          ...block,
          phone: contact.phone ?? "",
          email: contact.email ?? "",
          address: formattedAddress,
        };
      });
      if (!changed) return;
      await supabase
        .from("inst_site_pages")
        .update({ content: next as unknown as Json })
        .eq("id", page.id)
        .eq("tenant_id", tenantId);
    }),
  );
}

export async function saveTenantPublicProfile(
  supabase: Db,
  tenantId: string,
  input: {
    displayName?: string;
    description?: string | null;
    contact?: Partial<TenantContactInput>;
    address?: Partial<TenantAddressInput>;
  },
): Promise<{ error?: string }> {
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("branding")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr) return { error: tenantErr.message };
  if (!tenant) return { error: "tenant_not_found" };

  const branding = asRecord(tenant.branding);
  const currentContact = readContact(branding);
  const currentAddress = readAddress(branding);
  const nextContact: TenantContactInput = {
    email:
      input.contact && "email" in input.contact
        ? input.contact.email ?? null
        : currentContact.email,
    phone:
      input.contact && "phone" in input.contact
        ? input.contact.phone ?? null
        : currentContact.phone,
    website:
      input.contact && "website" in input.contact
        ? input.contact.website ?? null
        : currentContact.website,
  };
  const nextAddress: TenantAddressInput = {
    line1:
      input.address && "line1" in input.address
        ? input.address.line1 ?? null
        : currentAddress.line1,
    line2:
      input.address && "line2" in input.address
        ? input.address.line2 ?? null
        : currentAddress.line2,
    city:
      input.address && "city" in input.address
        ? input.address.city ?? null
        : currentAddress.city,
    postalCode:
      input.address && "postalCode" in input.address
        ? input.address.postalCode ?? null
        : currentAddress.postalCode,
    country:
      input.address && "country" in input.address
        ? input.address.country ?? null
        : currentAddress.country,
  };

  const nextBranding: Record<string, unknown> = {
    ...branding,
    contact: nextContact,
    address: nextAddress,
  };
  if (input.displayName !== undefined) {
    nextBranding.displayName = input.displayName.trim() || null;
  }
  if (input.description !== undefined) {
    nextBranding.description = input.description?.trim() || null;
  }

  const { error: brandingErr } = await supabase
    .from("tenants")
    .update({ branding: nextBranding as Json })
    .eq("id", tenantId);
  if (brandingErr) return { error: brandingErr.message };

  if (input.displayName !== undefined) {
    await ensureSiteSettings(supabase, tenantId);
    const { error: settingsErr } = await supabase
      .from("inst_site_settings")
      .update({ display_name: input.displayName.trim() || null })
      .eq("tenant_id", tenantId);
    if (settingsErr) return { error: settingsErr.message };
  }

  if (input.contact !== undefined || input.address !== undefined) {
    await syncSiteContactBlocks(supabase, tenantId, nextContact, nextAddress);
  }

  return {};
}

export async function saveDefaultOpeningHours(
  supabase: Db,
  tenantId: string,
  days: Array<{ weekday: number; slots: TenantOpeningSlot[] }>,
): Promise<{ error?: string }> {
  const blocks: ScheduleBlock[] = [];
  for (const day of days) {
    if (day.weekday < 0 || day.weekday > 6) {
      return { error: "invalid_weekday" };
    }
    for (const slot of day.slots) {
      const start = slot.start.slice(0, 5);
      const end = slot.end.slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        return { error: "invalid_time" };
      }
      if (start >= end) return { error: "end_before_start" };
      blocks.push({ weekday: day.weekday, start_time: start, end_time: end });
    }
  }

  const parsed = parseBlocksJson(JSON.stringify(blocks));
  if (!parsed) return { error: "invalid_hours" };

  let { data: schedule } = await supabase
    .from("inst_schedules")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();

  if (!schedule) {
    const { data: created, error: createErr } = await supabase
      .from("inst_schedules")
      .insert({ tenant_id: tenantId, name: "Horaires institut", is_default: true })
      .select("id")
      .single();
    if (createErr || !created) {
      return { error: createErr?.message ?? "schedule_create_failed" };
    }
    schedule = created;
  }

  await supabase.from("inst_schedule_blocks").delete().eq("schedule_id", schedule.id);
  if (parsed.length > 0) {
    const { error } = await supabase.from("inst_schedule_blocks").insert(
      parsed.map((block) => ({
        schedule_id: schedule!.id,
        weekday: block.weekday,
        start_time: block.start_time,
        end_time: block.end_time,
      })),
    );
    if (error) return { error: error.message };
  }

  return {};
}
