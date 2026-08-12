import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadSaleDocumentPayload } from "@/lib/institut/sale-documents/load";
import { SaleDocumentView } from "@/components/institut/sale-documents/sale-document-view";
import { PrintDocumentButton } from "./print-button";

export default async function SaleDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireModule("institut");
  const locale = await getLocale();
  const t = await getTranslations("pos.documents");
  const supabase = await createClient();

  const payload = await loadSaleDocumentPayload(
    supabase,
    session.tenant.id,
    id,
    session.tenant.name,
  );

  if (!payload) notFound();

  return (
    <div>
      <div className="mx-auto flex max-w-4xl justify-end px-8 pt-6 print:hidden">
        <PrintDocumentButton label={t("print")} />
      </div>
      <SaleDocumentView payload={payload} locale={locale} />
    </div>
  );
}
