import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { loadLoyaltyPageData } from "@/app/(app)/institut/marketing/loyalty-actions";
import { LoyaltyManager } from "@/app/(app)/institut/marketing/loyalty-manager";

export default async function CompteInstitutFidelitePage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  await requireInstitutSettingsModule();
  const { program } = await searchParams;
  const { snapshot, integrations, services, selectedProgramId } =
    await loadLoyaltyPageData(program);

  return (
    <LoyaltyManager
      snapshot={snapshot}
      integrations={integrations}
      services={services}
      selectedProgramId={selectedProgramId}
    />
  );
}
