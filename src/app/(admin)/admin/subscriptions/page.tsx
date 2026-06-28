import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchSubscriptionListRows } from "@/lib/platform/subscriptions";
import { fetchActivePlansForSelect } from "@/lib/platform/tenants";
import { SubscriptionsManager } from "./subscriptions-manager";

export default async function AdminSubscriptionsPage() {
  await requirePlatformAdmin();
  const [subscriptions, plans] = await Promise.all([
    fetchSubscriptionListRows(),
    fetchActivePlansForSelect(),
  ]);
  return <SubscriptionsManager subscriptions={subscriptions} plans={plans} />;
}
