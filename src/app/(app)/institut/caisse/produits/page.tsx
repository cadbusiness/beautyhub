import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { deleteInternalProduct } from "../../caisse-actions";
import { InternalProductForm } from "./internal-product-form";

export default async function CaisseProduitsPage() {
 const session = await requireModule("institut");
 const supabase = await createClient();
 const { data: products } = await supabase
 .from("inst_products")
 .select("id, name, sku, price_cents, stock_quantity, created_at")
 .eq("tenant_id", session.tenant.id)
 .eq("source", "internal")
 .order("name");

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h1 className="text-2xl font-semibold text-slate-900">
 Produits internes
 </h1>
 <Link href="/institut/caisse">
 <Button variant="outline" type="button">
 Retour caisse
 </Button>
 </Link>
 </div>

 <p className="text-sm text-slate-500">
 Articles vendus a la caisse sans passer par WooCommerce (consommables, accessoires, etc.).
 </p>

 <div className="grid gap-6 md:grid-cols-[1fr_360px]">
 <div className="space-y-3">
 {(products ?? []).length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucun produit interne.</p>
 </Card>
 ) : (
 (products ?? []).map((p) => (
 <Card key={p.id} className="flex items-center justify-between gap-4">
 <div>
 <p className="font-medium text-slate-900">{p.name}</p>
 <p className="text-sm text-slate-500">
 {formatPrice(p.price_cents)}
 {p.sku ? ` · SKU ${p.sku}` : ""}
 {p.stock_quantity != null ? ` · Stock ${p.stock_quantity}` : ""}
 </p>
 </div>
 <form action={deleteInternalProduct}>
 <input type="hidden" name="id" value={p.id} />
 <Button variant="ghost" type="submit" className="text-red-600">
 Supprimer
 </Button>
 </form>
 </Card>
 ))
 )}
 </div>

 <Card className="h-fit">
 <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Nouveau produit
 </h2>
 <InternalProductForm />
 </Card>
 </div>
 </div>
 );
}
