import { requireModule } from "@/lib/auth/guards";
import { loadLoyaltyPageData } from "../loyalty-actions";
import { LoyaltyManager } from "../loyalty-manager";

export default async function MarketingFidelitePage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  await requireModule("institut");
  const { program } = await searchParams;
  const { snapshot, integrations, services, selectedProgramId } = await loadLoyaltyPageData(program);

  return (
    <LoyaltyManager
      snapshot={snapshot}
      integrations={integrations}
      services={services}
      selectedProgramId={selectedProgramId}
    />
  );
}
