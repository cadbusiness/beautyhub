import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { startStripeConnect, disconnectStripe } from "../stripe-actions";

export async function StripeConnectActions({
  connected,
  chargesEnabled,
  accountId,
}: {
  connected: boolean;
  chargesEnabled: boolean;
  accountId?: string;
}) {
  const t = await getTranslations("institut.stripe");

  return (
    <div className="space-y-3">
      {accountId ? (
        <p className="text-sm text-slate-600">
          {t("account")} <code className="text-xs">{accountId}</code>
          {chargesEnabled ? (
            <span className="ml-2 text-green-600">{t("paymentsActive")}</span>
          ) : (
            <span className="ml-2 text-amber-600">{t("onboardingIncomplete")}</span>
          )}
        </p>
      ) : null}

      {connected && chargesEnabled ? (
        <form action={disconnectStripe}>
          <Button variant="outline" type="submit" className="text-red-600">
            {t("disconnect")}
          </Button>
        </form>
      ) : (
        <form action={startStripeConnect}>
          <Button type="submit">
            {accountId ? t("resumeOnboarding") : t("connect")}
          </Button>
        </form>
      )}
    </div>
  );
}
