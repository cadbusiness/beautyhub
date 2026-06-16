import { requireModule } from "@/lib/auth/guards";
import { getTenantConnectionStatus } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WooConnectionForm } from "./woo-connection-form";
import { disconnectWoo } from "../woo-actions";

export default async function ParametresPage() {
  const session = await requireModule("institut");
  const woo = await getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER);
  const connected = woo?.status === "connected";
  const url = typeof woo?.config?.url === "string" ? woo.config.url : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        Parametres
      </h1>

      <Card className="max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-slate-900 dark:text-white">WooCommerce</h2>
            <p className="text-sm text-slate-500">
              Logiciel de caisse / catalogue produits de l&apos;institut.
            </p>
          </div>
          <span
            className={
              connected
                ? "rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700"
                : "rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }
          >
            {connected ? "Connecte" : "Non connecte"}
          </span>
        </div>

        {connected ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Boutique: <span className="font-medium">{url}</span>
            </p>
            <form action={disconnectWoo}>
              <Button variant="outline" type="submit" className="text-red-600">
                Deconnecter
              </Button>
            </form>
          </div>
        ) : (
          <WooConnectionForm defaultUrl={url} />
        )}
      </Card>

      <p className="max-w-xl text-xs text-slate-400">
        Les cles API sont chiffrees (AES-256-GCM) avant stockage. Cree une cle API
        WooCommerce en lecture/ecriture depuis WooCommerce &gt; Reglages &gt; Avance &gt; API REST.
      </p>
    </div>
  );
}
