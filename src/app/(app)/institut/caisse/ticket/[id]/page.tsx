import { redirect, notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function TicketRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("inst_sales")
    .select("id")
    .eq("tenant_id", session.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (!sale) notFound();

  const { data: ticketDoc } = await supabase
    .from("inst_sale_documents")
    .select("id")
    .eq("tenant_id", session.tenant.id)
    .eq("sale_id", sale.id)
    .eq("doc_type", "ticket")
    .maybeSingle();

  if (ticketDoc) {
    redirect(`/institut/caisse/documents/${ticketDoc.id}`);
  }

  redirect(`/institut/caisse/historique`);
}
