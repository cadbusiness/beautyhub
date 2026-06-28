import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppLogo } from "@/components/app-shell/app-logo";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";

export async function AdminHeader({
  email,
  roleText,
  displayName,
  profileInitial,
}: {
  email: string | null;
  roleText: string;
  displayName: string;
  profileInitial: string;
}) {
  const t = await getTranslations("admin.layout");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
      <AppLogo />

      <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />

      <Link
        href="/dashboard"
        prefetch
        className="text-sm text-slate-600 hover:text-slate-900"
      >
        {t("backToApp")}
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <LocaleSwitcher className="hidden sm:inline-flex" />
        <UserMenu
          email={email}
          roleText={roleText}
          displayName={displayName}
          initial={profileInitial}
        />
      </div>
    </header>
  );
}
