import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { canManageInstitutSettings } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { getTenantConnectionStatus } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { getStripeAccountForTenant } from "@/lib/stripe/index";
import { buildCatalog } from "@/lib/institut/pos";
import { buildPosAppointmentOption } from "@/lib/institut/pos-appointment";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { getOpenCashSession } from "@/lib/institut/pos-session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PosTerminal } from "./pos-terminal";
import { syncWooProducts } from "../woo-actions";

const APPOINTMENT_SELECT =
  "id, client_id, staff_id, service_id, starts_at, clients(full_name, email), inst_services(name), extras:inst_appointment_extras(service_id, quantity, name)";

export default async function CaissePage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>;
}) {
  const t = await getTranslations("institut.pos");
  const { appointment: initialAppointmentId } = await searchParams;
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const dayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const [woo, stripeAccount, servicesRes, productsRes, clientsRes, posSettings, staffRes, apptsRes, cashSession, linkedApptRes] =
    await Promise.all([
    getTenantConnectionStatus(tenantId, WOO_PROVIDER),
    getStripeAccountForTenant(tenantId),
    supabase
      .from("inst_services")
      .select("id, name, price_cents, color, duration_min, image_url, visibility")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inst_products")
      .select("id, name, price_cents, image_url, source, sku, status, woo_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "publish"])
      .order("name"),
    supabase
      .from("clients")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    getPosSettings(supabase, tenantId),
    supabase
      .from("inst_staff")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .order("full_name"),
    supabase
      .from("inst_appointments")
      .select(APPOINTMENT_SELECT)
      .eq("tenant_id", tenantId)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd)
      .in("status", ["booked", "confirmed", "completed"])
      .order("starts_at"),
    getOpenCashSession(supabase, tenantId),
    initialAppointmentId
      ? supabase
          .from("inst_appointments")
          .select(APPOINTMENT_SELECT)
          .eq("tenant_id", tenantId)
          .eq("id", initialAppointmentId)
          .in("status", ["booked", "confirmed", "completed"])
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const connected = woo?.status === "connected";
  const catalog = buildCatalog(servicesRes.data ?? [], productsRes.data ?? []);
  const clients = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
  }));
  const staff = (staffRes.data ?? []).map((s) => ({
    id: s.id,
    label: s.full_name,
  }));
  const appointmentRows = [...(apptsRes.data ?? [])];
  if (
    linkedApptRes.data &&
    !appointmentRows.some((a) => a.id === linkedApptRes.data!.id)
  ) {
    appointmentRows.push(linkedApptRes.data);
    appointmentRows.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }
  const appointments = appointmentRows.map((a) =>
    buildPosAppointmentOption(
      a as Parameters<typeof buildPosAppointmentOption>[0],
    ),
  );

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeEnabled = Boolean(stripeAccount && stripePublishableKey);
  const canSettings = canManageInstitutSettings(
    session.role,
    session.enabledModuleIds,
  );

  return (
    <div className="space-y-4 px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canSettings ? (
          <Link href="/compte/institut/caisse">
            <Button variant="outline" className="h-9">
              {t("settingsButton")}
            </Button>
          </Link>
        ) : null}
        {connected ? (
          <form action={syncWooProducts}>
            <Button variant="outline" type="submit" className="h-9">
              {t("syncWoo")}
            </Button>
          </form>
        ) : null}
      </div>

      {!connected && catalog.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-600">{t("emptyCatalog")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/institut/prestations">
              <Button variant="outline">{t("linkServices")}</Button>
            </Link>
            <Link href="/institut/caisse/produits">
              <Button variant="outline">{t("linkProducts")}</Button>
            </Link>
            <Link href="/compte/institut/woocommerce">
              <Button>{t("linkSettings")}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {!connected ? (
            <p className="text-sm text-slate-500">
              {t("wooNotConnected")}{" "}
              <Link href="/compte/institut/woocommerce" className="underline">
                {t("connectShop")}
              </Link>
            </p>
          ) : null}
          <PosTerminal
            catalog={catalog}
            clients={clients}
            staff={staff}
            appointments={appointments}
            initialAppointmentId={initialAppointmentId ?? undefined}
            settings={posSettings}
            sessionOpen={Boolean(cashSession)}
            requireSession={posSettings.require_open_session}
            stripeEnabled={stripeEnabled}
            stripePublishableKey={stripePublishableKey}
            stripeAccountId={stripeAccount?.accountId}
          />
        </>
      )}
    </div>
  );
}
