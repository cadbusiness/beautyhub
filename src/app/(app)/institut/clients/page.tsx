import { requireModule } from "@/lib/auth/guards";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  await requireModule("institut");
  return <ClientsManager />;
}
