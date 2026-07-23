import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppLogo } from "@/components/app-shell/app-logo";

export async function LegalShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const t = await getTranslations("legal.nav");

  const links = [
    { href: "/legal/confidentialite", label: t("privacy") },
    { href: "/legal/cgu", label: t("terms") },
    { href: "/legal/sous-traitants", label: t("subprocessors") },
    { href: "/legal/securite", label: t("security") },
    { href: "/legal/dpa", label: t("dpa") },
  ];

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <AppLogo href="/" />
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="prose prose-slate mt-8 max-w-none text-sm leading-relaxed">{children}</div>
      </main>
      <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-700">
          ← BeautyHub
        </Link>
      </footer>
    </div>
  );
}
