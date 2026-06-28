import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { getTenantConnectionStatus } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { Button } from "@/components/ui/button";
import { disconnectWoo } from "@/app/(app)/institut/woo-actions";
import { WooConnectionForm } from "../woo-connection-form";
import { SettingsSection } from "../settings-section";

export default async function CompteInstitutWooPage() {
  const tWoo = await getTranslations("institut.woo");
  const tSettings = await getTranslations("institut.settings");
  const tCommon = await getTranslations("common");
  const session = await requireInstitutSettingsModule();

  const woo = await getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER);
  const wooConnected = woo?.status === "connected";
  const wooUrl = typeof woo?.config?.url === "string" ? woo.config.url : undefined;

  return (
    <>
      <SettingsSection
        title={tWoo("title")}
        description={tWoo("description")}
        status={wooConnected ? tWoo("connected") : tWoo("notConnected")}
        statusTone={wooConnected ? "success" : "neutral"}
      >
        {wooConnected ? (
          <div className="space-y-4">
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
          <WooConnectionForm defaultUrl={wooUrl} />
        )}
      </SettingsSection>

      <p className="text-xs leading-relaxed text-slate-400">{tSettings("securityNote")}</p>
    </>
  );
}
