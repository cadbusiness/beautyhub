import { requireModule } from "@/lib/auth/guards";
import { loadLoyaltyPageData } from "../loyalty-actions";
import { LoyaltyManager } from "../loyalty-manager";

export default async function MarketingFidelitePage() {
  await requireModule("institut");
  const { snapshot, integrations, services, loyaltyPublicUrl } = await loadLoyaltyPageData();

  return (
    <LoyaltyManager
      snapshot={snapshot}
      integrations={integrations}
      services={services}
      loyaltyPublicUrl={loyaltyPublicUrl}
    />
  );
}
