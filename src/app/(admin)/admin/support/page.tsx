import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchSupportTickets } from "@/lib/platform/support";
import { SupportManager } from "./support-manager";

export default async function AdminSupportPage() {
  await requirePlatformAdmin();
  const tickets = await fetchSupportTickets();

  return <SupportManager tickets={tickets} />;
}
