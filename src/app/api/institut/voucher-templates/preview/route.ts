import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import {
  DEFAULT_VOUCHER_LAYOUT,
  normalizeVoucherLayout,
  renderGiftCardPdfBuffer,
  VOUCHER_ASSETS_BUCKET,
} from "@/lib/institut/voucher-pdf";

export async function POST(request: Request) {
  try {
    await requireModule("institut");
    const body = (await request.json()) as {
      title?: string;
      subtitle?: string;
      footer_text?: string;
      layout?: unknown;
      background_path?: string | null;
      background_url?: string | null;
    };

    const layout = normalizeVoucherLayout(
      (body.layout as typeof DEFAULT_VOUCHER_LAYOUT) ?? DEFAULT_VOUCHER_LAYOUT,
    );

    let backgroundUrl = typeof body.background_url === "string" ? body.background_url : null;
    if (!backgroundUrl && typeof body.background_path === "string" && body.background_path) {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
      if (base) {
        backgroundUrl = `${base}/storage/v1/object/public/${VOUCHER_ASSETS_BUCKET}/${body.background_path}`;
      }
    }

    const buffer = await renderGiftCardPdfBuffer(
      {
        title: body.title?.trim() || "Carte cadeau",
        subtitle: body.subtitle?.trim() || "",
        footer_text: body.footer_text?.trim() || "",
        layout,
        background_path: body.background_path ?? null,
      },
      {
        code: "GC-PREVIEW",
        amountCents: 5000,
        recipientName: "Alex Martin",
        message: "Avec toute notre affection",
        currency: "eur",
      },
      { backgroundUrl },
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="gift-card-preview.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[voucher-templates/preview]", error);
    return NextResponse.json({ error: "preview_failed" }, { status: 500 });
  }
}
