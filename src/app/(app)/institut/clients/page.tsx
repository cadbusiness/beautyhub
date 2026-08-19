import { requireInstitutAccess } from "@/lib/auth/guards";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const session = await requireInstitutAccess("clients", "read");
  return <ClientsManager tenantSlug={session.tenant.slug} />;
}
