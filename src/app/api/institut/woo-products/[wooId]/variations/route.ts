import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { getWooClientForTenant } from "@/lib/woocommerce";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wooId: string }> },
) {
  try {
    const session = await requireModule("institut");
    const { wooId: raw } = await context.params;
    const wooId = Number.parseInt(raw, 10);
    if (!Number.isFinite(wooId) || wooId <= 0) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const client = await getWooClientForTenant(session.tenant.id);
    if (!client) {
      return NextResponse.json({ variations: [] });
    }

    const variations = await client.listProductVariations(wooId);
    return NextResponse.json({
      variations: variations.map((v) => ({
        id: v.id,
        name: v.name || `#${v.id}`,
        sku: v.sku || "",
      })),
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[woo-products/variations]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
