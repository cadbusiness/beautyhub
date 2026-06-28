import Link from "next/link";

export interface PublicSiteNavLink {
  href: string;
  label: string;
}

export function PublicSiteHeader({
  displayName,
  logoUrl,
  primaryColor,
  navLinks,
  activePath = "/",
}: {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string;
  navLinks: PublicSiteNavLink[];
  activePath?: string;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-4 lg:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-auto max-w-[140px] shrink-0 object-contain" />
          ) : null}
          <p className="truncate text-lg font-semibold" style={{ color: primaryColor }}>
            {displayName}
          </p>
        </Link>
        <nav className="flex shrink-0 flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
          {navLinks.map((link) => (
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
  shell,
  activePath,
  mainStyle,
  children,
}: {
  shell: {
    displayName: string;
    logoUrl: string | null;
    primaryColor: string;
    footerText: string | null;
    navLinks: PublicSiteNavLink[];
  };
  activePath?: string;
  mainStyle?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full w-full flex-col bg-white">
      <PublicSiteHeader
        displayName={shell.displayName}
        logoUrl={shell.logoUrl}
        primaryColor={shell.primaryColor}
        navLinks={shell.navLinks}
        activePath={activePath}
      />
      <main className="w-full flex-1" style={mainStyle}>
        {children}
      </main>
      {shell.footerText ? (
        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 lg:px-6">
          {shell.footerText}
        </footer>
      ) : null}
    </div>
  );
}
