import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const MODULE_KEYS = [
  "appointments",
  "pos",
  "academie",
  "assistant",
  "whitelabel",
  "multitenant",
] as const;

const STEP_KEYS = ["1", "2", "3"] as const;

const STAT_KEYS = ["modules", "isolation", "ai"] as const;

export async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              B
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              {t("brand")}
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/reserver">
              <Button variant="ghost">{t("nav.book")}</Button>
            </Link>
            <Link href="/login">
              <Button>{t("nav.teamLogin")}</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-20 pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(15 23 42 / 0.06), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-sm text-slate-600">
            {t("hero.badge")}
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            {t("hero.titleLine1")}
            <span className="block text-slate-600">{t("hero.titleLine2")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{t("hero.description")}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login">
              <Button className="h-12 px-8 text-base">{t("hero.ctaBackOffice")}</Button>
            </Link>
            <Link href="/client/login">
              <Button variant="outline" className="h-12 px-8 text-base">
                {t("hero.ctaClient")}
              </Button>
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-3 gap-6 border-t border-slate-200 pt-10 text-center sm:mx-auto sm:max-w-lg">
            {STAT_KEYS.map((key) => (
              <div key={key}>
                <p className="text-2xl font-semibold text-slate-900">
                  {t(`hero.stats.${key}.value`)}
                </p>
                <p className="text-xs text-slate-500">{t(`hero.stats.${key}.label`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-slate-900">{t("modules.title")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600">
            {t("modules.subtitle")}
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_KEYS.map((key) => (
              <Card
                key={key}
                className="transition-colors hover:border-slate-300 hover:shadow-md"
              >
                <span className="text-2xl">{moduleIcon(key)}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{t(`modules.items.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-slate-600">{t(`modules.items.${key}.text`)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-slate-900">{t("steps.title")}</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEP_KEYS.map((key) => (
              <div key={key} className="text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {key}
                </span>
                <h3 className="mt-4 font-medium text-slate-900">{t(`steps.items.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-slate-600">{t(`steps.items.${key}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">{t("cta.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("cta.subtitle")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button className="h-11 px-6">{t("cta.teamLogin")}</Button>
            </Link>
            <Link href="/reserver">
              <Button variant="outline" className="h-11 px-6">
                {t("cta.book")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-center text-xs text-slate-500">
        <p>{t("footer")}</p>
        <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/legal/confidentialite" className="hover:text-slate-700">
            {t("footerLinks.privacy")}
          </Link>
          <Link href="/legal/cgu" className="hover:text-slate-700">
            {t("footerLinks.terms")}
          </Link>
          <Link href="/legal/securite" className="hover:text-slate-700">
            {t("footerLinks.security")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}

function moduleIcon(key: (typeof MODULE_KEYS)[number]): string {
  const icons: Record<(typeof MODULE_KEYS)[number], string> = {
    appointments: "📅",
    pos: "🛒",
    academie: "🎓",
    assistant: "🤖",
    whitelabel: "🏷️",
    multitenant: "🔐",
  };
  return icons[key];
}
