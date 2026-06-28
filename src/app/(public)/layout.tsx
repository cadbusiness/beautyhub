import Link from "next/link";
import { redirect } from "next/navigation";
import { AppFooter } from "@/components/app-shell/app-footer";
import { getTenantContext } from "@/lib/tenant/context";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantContext();
  if (!tenant) redirect("/");

  const branding = tenant.branding as { appName?: string; primaryColor?: string };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {branding.appName ?? tenant.name}
            </p>
            <p className="text-xs text-slate-500">Reservation en ligne</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/reserver" className="text-slate-600 hover:text-slate-900 hover:underline">
              Reserver
            </Link>
            <Link href="/client/login" className="text-slate-600 hover:text-slate-900 hover:underline">
              Mon compte
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6">{children}</main>
      <AppFooter />
    </div>
  );
}
