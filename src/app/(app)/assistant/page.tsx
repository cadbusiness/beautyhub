import { requireTenantSession } from "@/lib/auth/guards";
import { getAiActionsFor } from "@/modules";
import { AssistantClient } from "./assistant-client";

export default async function AssistantPage() {
 const session = await requireTenantSession();
 const actions = getAiActionsFor(session.enabledModuleIds, session.role);

 return (
 <div className="space-y-6">
 <header>
 <h1 className="text-2xl font-semibold text-slate-900">
 Assistant IA
 </h1>
 <p className="mt-1 text-sm text-slate-500">
 MVP manuel — selectionne une action du registre module et execute-la.
 </p>
 </header>
 <AssistantClient
 actions={actions.map((a) => ({
 name: a.name,
 description: a.description,
 }))}
 />
 </div>
 );
}
