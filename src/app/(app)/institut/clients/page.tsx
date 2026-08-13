import { requireModule } from "@/lib/auth/guards";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const session = await requireModule("institut");
  return <ClientsManager tenantSlug={session.tenant.slug} />;
}
