import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const PLUGIN_SLUG = "beautyhub-connector";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "extensions/woocommerce", PLUGIN_SLUG);
const manifestPath = join(root, "src/lib/connectors/woocommerce/manifest.ts");
const manifest = readFileSync(manifestPath, "utf8");
const versionMatch = manifest.match(/version:\s*"([^"]+)"/);
const version = versionMatch?.[1] ?? "1.0.0";

function collectFiles(dir, rootDir, zipRoot, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(rootDir, full).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) {
      collectFiles(full, rootDir, zipRoot, out);
    } else {
      out[`${zipRoot}/${rel}`] = new Uint8Array(readFileSync(full));
    }
  }
}

const files = {};
collectFiles(sourceDir, sourceDir, PLUGIN_SLUG, files);
const zip = zipSync(files);

const outDir = join(root, "public/downloads");
mkdirSync(outDir, { recursive: true });

const versionedPath = join(outDir, `${PLUGIN_SLUG}-${version}.zip`);
const stablePath = join(outDir, `${PLUGIN_SLUG}.zip`);

writeFileSync(versionedPath, zip);
copyFileSync(versionedPath, stablePath);

console.log(
  `Wrote ${versionedPath} + ${stablePath} (${zip.byteLength} bytes, ${Object.keys(files).length} entries, v${version})`,
);
