import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "extensions/woocommerce/beautyhub-connector");
const manifestPath = join(root, "src/lib/connectors/woocommerce/manifest.ts");
const manifest = readFileSync(manifestPath, "utf8");
const versionMatch = manifest.match(/version:\s*"([^"]+)"/);
const version = versionMatch?.[1] ?? "1.0.0";

function collectFiles(dir, rootDir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(rootDir, full).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) {
      collectFiles(full, rootDir, out);
    } else {
      out[rel] = new Uint8Array(readFileSync(full));
    }
  }
}

const files = {};
collectFiles(sourceDir, sourceDir, files);
const zip = zipSync(files);

const outDir = join(root, "public/downloads");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `beautyhub-connector-${version}.zip`);
writeFileSync(outPath, zip);

console.log(`Wrote ${outPath} (${zip.byteLength} bytes, ${Object.keys(files).length} files)`);
