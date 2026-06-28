import { requireModule } from "@/lib/auth/guards";
import { getTenantConnectionStatus } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { isStripeConfigured } from "@/lib/stripe/client";
import { STRIPE_CONNECT_PROVIDER } from "@/lib/stripe/index";
import { syncStripeConnectStatus } from "../stripe-actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WooConnectionForm } from "./woo-connection-form";
import { StripeConnectActions } from "./stripe-connect-actions";
import { disconnectWoo } from "../woo-actions";

export default async function ParametresPage({
 searchParams,
}: {
 searchParams: Promise<{ stripe?: string }>;
}) {
 const session = await requireModule("institut");
 const params = await searchParams;

 const [woo, stripeStatus] = await Promise.all([
 getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER),
 getTenantConnectionStatus(session.tenant.id, STRIPE_CONNECT_PROVIDER),
 ]);

 if (params.stripe === "return" || params.stripe === "refresh") {
 await syncStripeConnectStatus(session.tenant.id);
 }

 const wooConnected = woo?.status === "connected";
 const wooUrl = typeof woo?.config?.url === "string" ? woo.config.url : undefined;

 const stripeConfigured = isStripeConfigured();
 const accountId =
 typeof stripeStatus?.config?.accountId === "string"
 ? stripeStatus.config.accountId
 : undefined;
 const chargesEnabled = stripeStatus?.config?.chargesEnabled === true;
 const stripeConnected = stripeStatus?.status === "connected" && chargesEnabled;

 return (
 <div className="space-y-6">

 <Card className="max-w-xl space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="font-medium text-slate-900">WooCommerce</h2>
 <p className="text-sm text-slate-500">
 Catalogue produits et commandes de la caisse.
 </p>
 </div>
 <span
 className={
 wooConnected
 ? "rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700"
 : "rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
 }
 >
 {wooConnected ? "Connecte" : "Non connecte"}
 </span>
 </div>

 {wooConnected ? (
 <div className="space-y-3">
 <p className="text-sm text-slate-600">
 Boutique: <span className="font-medium">{wooUrl}</span>
 </p>
 <form action={disconnectWoo}>
 <Button variant="outline" type="submit" className="text-red-600">
 Deconnecter
 </Button>
 </form>
 </div>
 ) : (
 <WooConnectionForm defaultUrl={wooUrl} />
 )}
 </Card>

 <Card className="max-w-xl space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="font-medium text-slate-900">Stripe Connect</h2>
 <p className="text-sm text-slate-500">
 Encaissement carte a la caisse (compte Express de l&apos;institut).
 </p>
 </div>
 <span
 className={
 stripeConnected
 ? "rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700"
 : "rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
 }
 >
 {stripeConnected ? "Actif" : "Non connecte"}
 </span>
 </div>

 {!stripeConfigured ? (
 <p className="text-sm text-amber-700">
 STRIPE_SECRET_KEY non configure sur la plateforme. Ajoute-la dans .env.local
 pour activer Stripe Connect.
 </p>
 ) : params.stripe === "missing_key" ? (
 <p className="text-sm text-red-600">Cle Stripe plateforme manquante.</p>
 ) : (
 <StripeConnectActions
 connected={stripeConnected}
 chargesEnabled={chargesEnabled}
 accountId={accountId}
 />
 )}
 </Card>

 <p className="max-w-xl text-xs text-slate-400">
 Les cles API WooCommerce sont chiffrees (AES-256-GCM) avant stockage. Stripe Connect
 utilise un compte Express par institut; les paiements sont routes vers ce compte.
 </p>
 </div>
 );
}
