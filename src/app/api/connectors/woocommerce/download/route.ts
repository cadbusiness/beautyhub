import { execSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NextResponse } from "next/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { wooConnectorManifest } from "@/lib/connectors";

export async function GET() {
  await requireInstitutSettingsModule();

  const packagePath = wooConnectorManifest.packagePath;
  if (!packagePath) {
    return NextResponse.json({ error: "no_package" }, { status: 404 });
  }

  const sourceDir = join(process.cwd(), packagePath);
  if (!existsSync(sourceDir)) {
    return NextResponse.json({ error: "package_missing" }, { status: 404 });
  }

  const tempDir = mkdtempSync(join(tmpdir(), "bh-woo-"));
  const zipPath = join(tempDir, "beautyhub-connector.zip");

  try {
    execSync(`zip -r "${zipPath}" .`, { cwd: sourceDir, stdio: "pipe" });
    const buffer = readFileSync(zipPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="beautyhub-connector-${wooConnectorManifest.version}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
