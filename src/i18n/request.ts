import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  resolveLocaleFromAcceptLanguage,
} from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const headerLocale = resolveLocaleFromAcceptLanguage((await headers()).get("accept-language"));
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : headerLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
