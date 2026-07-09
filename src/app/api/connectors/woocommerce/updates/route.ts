import { NextResponse } from "next/server";
import { getWooConnectorRelease } from "@/lib/connectors/woocommerce/release";

function semverGt(a: string, b: string): boolean {
  return a !== b && compareSemver(a, b) > 0;
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, "").split(/[-+]/)[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "check_update";
  const slug = url.searchParams.get("slug") ?? "";
  const installedVersion = url.searchParams.get("version") ?? "0.0.0";

  const release = getWooConnectorRelease();

  if (slug && slug !== release.slug) {
    return NextResponse.json({ error: "unknown_plugin" }, { status: 404 });
  }

  if (action === "plugin_information") {
    return NextResponse.json({
      name: release.name,
      slug: release.slug,
      version: release.version,
      author: release.author,
      author_profile: release.author_profile,
      homepage: release.homepage,
      requires: release.requires,
      tested: release.tested,
      requires_php: release.requires_php,
      download_url: release.download_url,
      sections: {
        description: release.description,
        installation: release.installation,
        changelog: release.changelog,
      },
    });
  }

  const updateAvailable = semverGt(release.version, installedVersion);

  return NextResponse.json({
    slug: release.slug,
    name: release.name,
    version: release.version,
    latest_version: release.version,
    update_available: updateAvailable,
    download_url: updateAvailable ? release.download_url : "",
    homepage: release.homepage,
    tested_wp: release.tested,
    requires_php: release.requires_php,
    changelog: release.changelog,
  });
}
