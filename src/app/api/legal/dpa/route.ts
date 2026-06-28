import { NextResponse } from "next/server";
import { buildDpaDocument } from "@/lib/compliance/tenant-compliance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantName = searchParams.get("tenant")?.trim() || "Mon institut";
  const tenantLegal = searchParams.get("legal")?.trim() || tenantName;
  const date = new Date().toISOString().slice(0, 10);

  const body = buildDpaDocument({
    platformName: "BeautyHub",
    platformAddress: "À compléter — adresse de l'éditeur",
    tenantName,
    tenantLegalName: tenantLegal,
    date,
  });

  const safeName = tenantName.replace(/[^\w\s-]/g, "").slice(0, 40);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="beautyhub-dpa-${safeName || "institut"}.md"`,
    },
  });
}
