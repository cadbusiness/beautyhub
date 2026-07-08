import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { getTenantConnectionStatus, updateTenantConnectionConfig } from "@/lib/connections";
import { apiBaseUrl } from "@/lib/app-url";
import { wooConnectorManifest } from "@/lib/connectors";
import { WOO_PROVIDER, generateWebhookCredentials } from "@/lib/woocommerce";
import { Button } from "@/components/ui/button";
import { disconnectWoo } from "@/app/(app)/institut/woo-actions";
import { WooConnectionForm } from "../woo-connection-form";
import { WooSetupGuide } from "../woo-setup-guide";
import { WooWebhookCredentials } from "../woo-webhook-credentials";
import { SettingsSection } from "../settings-section";

async function ensureWebhookCredentials(
  tenantId: string,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (
    typeof config.webhook_token === "string" &&
    typeof config.webhook_secret === "string"
  ) {
    return config;
  }

  const creds = generateWebhookCredentials();
  const next = {
    ...config,
    webhook_token: creds.webhookToken,
    webhook_secret: creds.webhookSecret,
  };

  const existing = await getTenantConnectionStatus(tenantId, WOO_PROVIDER);
  if (existing?.status === "connected") {
    await updateTenantConnectionConfig(tenantId, WOO_PROVIDER, next);
  }

  return next;
}

export default async function CompteInstitutWooPage() {
  const tWoo = await getTranslations("institut.woo");
  const tSettings = await getTranslations("institut.settings");
  const tCommon = await getTranslations("common");
  const session = await requireInstitutSettingsModule();

  const woo = await getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER);
  const wooConnected = woo?.status === "connected";
  const wooUrl = typeof woo?.config?.url === "string" ? woo.config.url : undefined;

  let config = (woo?.config ?? {}) as Record<string, unknown>;
  if (wooConnected) {
    config = await ensureWebhookCredentials(session.tenant.id, config);
  }

  const webhookToken =
    typeof config.webhook_token === "string" ? config.webhook_token : "";
  const webhookSecret =
    typeof config.webhook_secret === "string" ? config.webhook_secret : "";
  const webhookUrl = webhookToken
    ? `${apiBaseUrl()}/api/webhooks/woocommerce/${webhookToken}`
    : "";

  return (
    <>
      <SettingsSection
        title={tWoo("title")}
        description={tWoo("description")}
        status={wooConnected ? tWoo("connected") : tWoo("notConnected")}
        statusTone={wooConnected ? "success" : "neutral"}
      >
        <WooSetupGuide
          connected={wooConnected}
          connectorVersion={wooConnectorManifest.version}
        />

        {wooConnected && webhookToken && webhookSecret ? (
          <WooWebhookCredentials
            webhookUrl={webhookUrl}
            webhookToken={webhookToken}
            webhookSecret={webhookSecret}
          />
        ) : null}

        {wooConnected ? (
          <div className="space-y-4 pt-4">
            <p className="text-sm text-slate-600">
              {tWoo("shop")} <span className="font-medium text-slate-900">{wooUrl}</span>
            </p>
            <form action={disconnectWoo}>
              <Button variant="outline" type="submit" className="text-red-600">
                {tCommon("disconnect")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="pt-4">
            <WooConnectionForm defaultUrl={wooUrl} />
          </div>
        )}
      </SettingsSection>

      <p className="text-xs leading-relaxed text-slate-400">{tSettings("securityNote")}</p>
    </>
  );
}
