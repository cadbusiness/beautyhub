import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { zipSync } from "fflate";
import { NextResponse } from "next/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { wooConnectorManifest } from "@/lib/connectors";

function collectFiles(
  dir: string,
  root: string,
  out: Record<string, Uint8Array>,
): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(root, full).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) {
      collectFiles(full, root, out);
    } else {
      out[rel] = new Uint8Array(readFileSync(full));
    }
  }
}

function zipDirectory(sourceDir: string): Buffer {
  const files: Record<string, Uint8Array> = {};
  collectFiles(sourceDir, sourceDir, files);
  return Buffer.from(zipSync(files));
}

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

  try {
    const buffer = zipDirectory(sourceDir);
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
  }
}
