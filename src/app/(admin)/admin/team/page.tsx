import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchPlatformTeamRows } from "@/lib/platform/team";
import { TeamManager } from "./team-manager";

export default async function AdminTeamPage() {
  const session = await requirePlatformAdmin();
  const members = await fetchPlatformTeamRows();
  return <TeamManager members={members} currentUserId={session.userId} />;
}
