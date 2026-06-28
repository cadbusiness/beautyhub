import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { getProfilePreferredLocale } from "@/lib/i18n/resolve-locale";
import {
  isLocale,
  LOCALE_COOKIE,
  resolveLocaleFromAcceptLanguage,
  type Locale,
} from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale: Locale;
  if (cookieLocale && isLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const profileLocale = await getProfilePreferredLocale();
    locale =
      profileLocale ??
      resolveLocaleFromAcceptLanguage((await headers()).get("accept-language"));
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
