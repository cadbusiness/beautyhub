import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { getTenantConnectionStatus } from "@/lib/connections";
import { isStripeConfigured } from "@/lib/stripe/client";
import { STRIPE_CONNECT_PROVIDER } from "@/lib/stripe/index";
import { syncStripeConnectStatus } from "@/app/(app)/institut/stripe-actions";
import { StripeConnectActions } from "../stripe-connect-actions";
import { SettingsSection } from "../settings-section";

export default async function CompteInstitutStripePage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const tStripe = await getTranslations("institut.stripe");
  const tSettings = await getTranslations("institut.settings");
  const session = await requireInstitutSettingsModule();
  const params = await searchParams;

  if (params.stripe === "return" || params.stripe === "refresh") {
    await syncStripeConnectStatus(session.tenant.id);
  }

  const stripeStatus = await getTenantConnectionStatus(
    session.tenant.id,
    STRIPE_CONNECT_PROVIDER,
  );

  const stripeConfigured = isStripeConfigured();
  const accountId =
    typeof stripeStatus?.config?.accountId === "string"
      ? stripeStatus.config.accountId
      : undefined;
  const chargesEnabled = stripeStatus?.config?.chargesEnabled === true;
  const stripeConnected = stripeStatus?.status === "connected" && chargesEnabled;

  return (
    <>
      <SettingsSection
        title={tStripe("title")}
        description={tStripe("description")}
        status={stripeConnected ? tStripe("active") : tStripe("notConnected")}
        statusTone={stripeConnected ? "success" : "neutral"}
      >
        {!stripeConfigured ? (
          <p className="text-sm text-amber-700">{tStripe("missingPlatformKey")}</p>
        ) : params.stripe === "missing_key" ? (
          <p className="text-sm text-red-600">{tStripe("missingKeyRedirect")}</p>
        ) : (
          <StripeConnectActions
            connected={stripeConnected}
            chargesEnabled={chargesEnabled}
            accountId={accountId}
          />
        )}
      </SettingsSection>

      <p className="text-xs leading-relaxed text-slate-400">{tSettings("securityNote")}</p>
    </>
  );
}
