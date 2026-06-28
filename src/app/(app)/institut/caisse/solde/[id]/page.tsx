import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { formatPrice } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { BalancePayPanel } from "./balance-pay-panel";

export default async function SoldePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("pos.balance");
  const session = await requireModule("institut");
  const supabase = await createClient();

  const [{ data: sale }, settings] = await Promise.all([
    supabase
      .from("inst_sales")
      .select(
        "id, ticket_number, total_cents, amount_paid_cents, status, clients(full_name, email)",
      )
      .eq("tenant_id", session.tenant.id)
      .eq("id", id)
      .maybeSingle(),
    getPosSettings(supabase, session.tenant.id),
  ]);

  if (!sale || sale.status !== "partial") notFound();

  const remaining = sale.total_cents - sale.amount_paid_cents;
  const client = sale.clients as { full_name: string | null; email: string } | null;

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4 lg:px-6">
      <Card className="space-y-3">
        <div>
          <p className="text-sm text-slate-500">{sale.ticket_number ?? t("sale")}</p>
          {client ? (
            <p className="text-slate-900">{client.full_name ?? client.email}</p>
          ) : null}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{t("total")}</span>
          <span className="tabular-nums">{formatPrice(sale.total_cents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{t("paid")}</span>
          <span className="tabular-nums">{formatPrice(sale.amount_paid_cents)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>{t("remaining")}</span>
          <span className="tabular-nums text-amber-700">{formatPrice(remaining)}</span>
        </div>
        <BalancePayPanel saleId={sale.id} remainingCents={remaining} settings={settings} />
      </Card>
      <Link href="/institut/caisse/historique" className="text-sm text-slate-500 underline">
        ← {t("back")}
      </Link>
    </div>
  );
}
