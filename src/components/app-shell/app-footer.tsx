import { getTranslations } from "next-intl/server";

export async function AppFooter() {
  const t = await getTranslations("shell");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-400 lg:px-6">
      © {year} BeautyHub. {t("footerRights")}
    </footer>
  );
}
