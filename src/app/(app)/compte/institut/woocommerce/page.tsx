import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { getTenantConnectionStatus } from "@/lib/connections";
import { wooConnectorManifest } from "@/lib/connectors";
import {
  buildPairingAdminUrl,
  createPairingToken,
  normalizeShopUrl,
} from "@/lib/connectors/pairing";
import { apiBaseUrl } from "@/lib/app-url";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { Button } from "@/components/ui/button";
import { disconnectWoo } from "@/app/(app)/institut/woo-actions";
import { WooConnectPanel } from "../woo-connect-panel";
import { WooSetupGuide } from "../woo-setup-guide";
import { SettingsSection } from "../settings-section";

export default async function CompteInstitutWooPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const tWoo = await getTranslations("institut.woo");
  const tSettings = await getTranslations("institut.settings");
  const tCommon = await getTranslations("common");
  const session = await requireInstitutSettingsModule();

  const woo = await getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER);
  const wooConnected = woo?.status === "connected";
  const wooUrl = typeof woo?.config?.url === "string" ? woo.config.url : undefined;

  const { shop } = await searchParams;
  let autoPairUrl: string | null = null;
  if (shop && !wooConnected) {
    try {
      const normalized = normalizeShopUrl(shop);
      new URL(normalized);
      const token = createPairingToken({
        tenantId: session.tenant.id,
        shopUrl: normalized,
        apiUrl: apiBaseUrl(),
      });
      autoPairUrl = buildPairingAdminUrl(normalized, token, apiBaseUrl());
    } catch {
      // URL invalide : on retombe sur le formulaire manuel ci-dessous.
    }
  }
  if (autoPairUrl) {
    redirect(autoPairUrl);
  }
  const pairedAt =
    typeof woo?.config?.paired_at === "string" ? woo.config.paired_at : null;

  return (
    <>
      <SettingsSection
        title={tWoo("title")}
        description={tWoo("description")}
        status={wooConnected ? tWoo("connected") : tWoo("notConnected")}
        statusTone={wooConnected ? "success" : "neutral"}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-900">
              {tWoo("connectSideTitle")}
            </h3>

            {wooConnected ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {tWoo("connectedBanner", { shop: wooUrl ?? "" })}
                </div>
                {pairedAt ? (
                  <p className="text-xs text-slate-500">
                    {tWoo("pairedAt", {
                      date: new Date(pairedAt).toLocaleString("fr-FR"),
                    })}
                  </p>
                ) : null}
                <form action={disconnectWoo}>
                  <Button variant="outline" type="submit" className="text-red-600">
                    {tCommon("disconnect")}
                  </Button>
                </form>
              </div>
            ) : (
              <WooConnectPanel defaultShopUrl={wooUrl} />
            )}
          </div>

          <aside className="lg:border-l lg:border-slate-200 lg:pl-8">
            <WooSetupGuide
              connected={wooConnected}
              connectorVersion={wooConnectorManifest.version}
            />
          </aside>
        </div>
      </SettingsSection>

      <p className="text-xs leading-relaxed text-slate-400">{tSettings("securityNote")}</p>
    </>
  );
}
