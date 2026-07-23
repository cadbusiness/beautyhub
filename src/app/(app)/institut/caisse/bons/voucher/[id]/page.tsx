import { notFound } from "next/navigation";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
export default async function VoucherDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("pos.vouchers");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();

  const [{ data: voucher }, { data: events }] = await Promise.all([
    supabase
      .from("inst_vouchers")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("inst_voucher_events")
      .select("id, event_type, amount_cents, balance_after_cents, source_channel, created_at")
      .eq("tenant_id", session.tenant.id)
      .eq("voucher_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!voucher) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5 bg-white p-8">
      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("vouchersTitle")}</p>
          <h1 className="font-mono text-xl font-semibold text-slate-900">{voucher.code}</h1>
          <p className="text-sm text-slate-500">
            {t(`types.${voucher.voucher_type as "voucher"}`)} ·{" "}
            {t(`status.${voucher.status as "active"}`)}
          </p>
        </div>
        <Link
          href={`/api/institut/vouchers/${voucher.id}/pdf`}
          target="_blank"
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t("downloadPdf")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("columns.balance")}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatPrice(voucher.current_balance_cents)}
          </p>
          <p className="text-xs text-slate-500">/ {formatPrice(voucher.initial_amount_cents)}</p>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("columns.date")}</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {format.dateTime(new Date(voucher.created_at), {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {(events ?? []).length > 0 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            {t("columns.lastEvent")}
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="flex justify-between py-2">
                <span className="text-slate-700">
                  {t(`events.${ev.event_type as "issue"}`)} · {formatPrice(ev.amount_cents)}
                </span>
                <span className="text-xs text-slate-400">
                  {format.dateTime(new Date(ev.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
