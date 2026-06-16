import { requireModule } from "@/lib/auth/guards";
import { Card } from "@/components/ui/card";

export default async function CaissePage() {
  await requireModule("institut");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        Caisse
      </h1>
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          La caisse se connectera a WooCommerce (1 boutique par institut) pour la
          vente de produits et la synchronisation du catalogue. Integration a venir
          dans la suite de la Phase 1.
        </p>
      </Card>
    </div>
  );
}
