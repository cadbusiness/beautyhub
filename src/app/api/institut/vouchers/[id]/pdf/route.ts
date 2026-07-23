import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createSignedGiftCardPdfUrl,
  generateAndStoreGiftCardPdf,
  ensureDefaultVoucherTemplate,
  getVoucherTemplateById,
  VOUCHER_PDFS_BUCKET,
} from "@/lib/institut/voucher-pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const service = createServiceClient();

    const { data: voucher } = await supabase
      .from("inst_vouchers")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("id", id)
      .maybeSingle();
    if (!voucher) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const meta =
      voucher.metadata && typeof voucher.metadata === "object" && !Array.isArray(voucher.metadata)
        ? (voucher.metadata as Record<string, unknown>)
        : {};

    let pdfPath = typeof meta.pdf_path === "string" ? meta.pdf_path : null;

    if (!pdfPath) {
      const templateId = typeof meta.template_id === "string" ? meta.template_id : null;
      const template = templateId
        ? ((await getVoucherTemplateById(service, session.tenant.id, templateId)) ??
          (await ensureDefaultVoucherTemplate(service, session.tenant.id)))
        : await ensureDefaultVoucherTemplate(service, session.tenant.id);
      pdfPath = await generateAndStoreGiftCardPdf(
        service,
        session.tenant.id,
        voucher.id,
        template,
        {
          code: voucher.code,
          amountCents: voucher.initial_amount_cents,
          recipientName: voucher.recipient_name,
          message: typeof meta.message === "string" ? meta.message : null,
          expiresAt: voucher.expires_at,
          currency: voucher.currency,
        },
      );
      await service
        .from("inst_vouchers")
        .update({
          metadata: {
            ...meta,
            template_id: template.id,
            pdf_path: pdfPath,
            pdf_generated_at: new Date().toISOString(),
          },
        })
        .eq("id", voucher.id)
        .eq("tenant_id", session.tenant.id);
    }

    const signed = await createSignedGiftCardPdfUrl(service, pdfPath);
    if (!signed) {
      const { data: file, error } = await service.storage
        .from(VOUCHER_PDFS_BUCKET)
        .download(pdfPath);
      if (error || !file) {
        return NextResponse.json({ error: "pdf_unavailable" }, { status: 500 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${voucher.code}.pdf"`,
        },
      });
    }

    return NextResponse.redirect(signed);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[vouchers/pdf]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
