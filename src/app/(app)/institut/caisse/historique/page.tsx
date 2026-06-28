import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

const PAYMENT_LABEL: Record<string, string> = {
 cash: "Especes",
 card: "Carte TPE",
 stripe: "Stripe",
};

export default async function CaisseHistoriquePage() {
 const session = await requireModule("institut");
 const supabase = await createClient();

 const { data: sales } = await supabase
 .from("inst_sales")
 .select(
 `
 id,
 total_cents,
 payment_method,
 status,
 woo_order_id,
 notes,
 created_at,
 clients ( full_name, email ),
 inst_sale_items ( name, quantity, unit_price_cents, item_type )
 `,
 )
 .eq("tenant_id", session.tenant.id)
 .order("created_at", { ascending: false })
 .limit(100);

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h1 className="text-2xl font-semibold text-slate-900">
 Historique des ventes
 </h1>
 <Link href="/institut/caisse">
 <Button variant="outline" type="button">
 Retour caisse
 </Button>
 </Link>
 </div>

 {(sales ?? []).length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucune vente enregistree.</p>
 </Card>
 ) : (
 <div className="space-y-3">
 {(sales ?? []).map((sale) => {
 const client = sale.clients as { full_name: string | null; email: string } | null;
 const items = (sale.inst_sale_items ?? []) as Array<{
 name: string;
 quantity: number;
 unit_price_cents: number;
 item_type: string;
 }>;
 const date = new Date(sale.created_at).toLocaleString("fr-FR", {
 dateStyle: "medium",
 timeStyle: "short",
 });
 const payment =
 PAYMENT_LABEL[sale.payment_method ?? "cash"] ?? sale.payment_method;

 return (
 <Card key={sale.id} className="space-y-2">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <p className="font-medium text-slate-900">
 {formatPrice(sale.total_cents)}
 <span className="ml-2 text-sm font-normal text-slate-500">
 · {payment}
 </span>
 </p>
 <p className="text-sm text-slate-500">{date}</p>
 {client ? (
 <p className="text-sm text-slate-500">
 {client.full_name ?? client.email}
 </p>
 ) : null}
 </div>
 <div className="text-right text-xs text-slate-400">
 {sale.woo_order_id ? <p>Woo #{sale.woo_order_id}</p> : null}
 <p className="uppercase">{sale.status}</p>
 </div>
 </div>
 <ul className="border-t border-slate-100 pt-2 text-sm">
 {items.map((item, i) => (
 <li key={i} className="flex justify-between text-slate-600">
 <span>
 {item.quantity}× {item.name}
 {item.item_type === "service" ? " (prestation)" : ""}
 </span>
 <span>{formatPrice(item.unit_price_cents * item.quantity)}</span>
 </li>
 ))}
 </ul>
 {sale.notes ? (
 <p className="text-xs italic text-slate-400">{sale.notes}</p>
 ) : null}
 </Card>
 );
 })}
 </div>
 )}
 </div>
 );
}
