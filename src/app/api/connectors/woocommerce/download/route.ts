import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { wooConnectorManifest } from "@/lib/connectors";

export async function GET() {
  await requireInstitutSettingsModule();

  const filename = `beautyhub-connector-${wooConnectorManifest.version}.zip`;
  const zipPath = join(process.cwd(), "public/downloads", filename);

  if (!existsSync(zipPath)) {
    return NextResponse.json({ error: "package_not_built" }, { status: 404 });
  }

  const bytes = new Uint8Array(readFileSync(zipPath));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
