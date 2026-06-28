import Link from "next/link";
import type { TenantContext } from "@/lib/tenant/context";

export function PublicSiteHeader({
  tenant,
  activePath = "/",
}: {
  tenant: TenantContext;
  activePath?: string;
}) {
  const branding = tenant.branding as { appName?: string; primaryColor?: string };
  const name = branding.appName ?? tenant.name;
  const accent = branding.primaryColor ?? "#0f172a";

  const links = [
    { href: "/", label: "Accueil" },
    { href: "/reserver", label: "Réserver" },
    { href: "/client/login", label: "Mon compte" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
        <Link href="/" className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900" style={{ color: accent }}>
            {name}
          </p>
        </Link>
        <nav className="flex shrink-0 gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                activePath === link.href
                  ? "font-medium text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function PublicSiteShell({
  tenant,
  activePath,
  children,
}: {
  tenant: TenantContext;
  activePath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PublicSiteHeader tenant={tenant} activePath={activePath} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
