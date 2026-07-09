import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { wooConnectorManifest } from "@/lib/connectors";

/** Téléchargement manuel depuis le back-office (même ZIP public que l’auto-update). */
export async function GET() {
  await requireInstitutSettingsModule();

  const stable = join(process.cwd(), "public/downloads/beautyhub-connector.zip");
  const versioned = join(
    process.cwd(),
    "public/downloads",
    `beautyhub-connector-${wooConnectorManifest.version}.zip`,
  );

  const zipPath = existsSync(stable) ? stable : versioned;
  if (!existsSync(zipPath)) {
    return NextResponse.json({ error: "package_not_built" }, { status: 404 });
  }

  const filename = `beautyhub-connector-${wooConnectorManifest.version}.zip`;
  const bytes = new Uint8Array(readFileSync(zipPath));

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
