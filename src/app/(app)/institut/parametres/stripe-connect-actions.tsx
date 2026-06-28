import { Button } from "@/components/ui/button";
import { startStripeConnect, disconnectStripe } from "../stripe-actions";

export function StripeConnectActions({
 connected,
 chargesEnabled,
 accountId,
}: {
 connected: boolean;
 chargesEnabled: boolean;
 accountId?: string;
}) {
 return (
 <div className="space-y-3">
 {accountId ? (
 <p className="text-sm text-slate-600">
 Compte: <code className="text-xs">{accountId}</code>
 {chargesEnabled ? (
 <span className="ml-2 text-green-600">· Paiements actifs</span>
 ) : (
 <span className="ml-2 text-amber-600">· Onboarding incomplet</span>
 )}
 </p>
 ) : null}

 {connected && chargesEnabled ? (
 <form action={disconnectStripe}>
 <Button variant="outline" type="submit" className="text-red-600">
 Deconnecter Stripe
 </Button>
 </form>
 ) : (
 <form action={startStripeConnect}>
 <Button type="submit">
 {accountId ? "Reprendre l'onboarding Stripe" : "Connecter Stripe"}
 </Button>
 </form>
 )}
 </div>
 );
}
