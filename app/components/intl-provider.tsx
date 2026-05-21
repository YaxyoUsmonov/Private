"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useMemo } from "react";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import uz from "../../messages/uz.json";
import { defaultLocale, normalizeLocale, type Locale } from "../../i18n/locales";
import { useAppData } from "../hooks/use-app-data";

const messages = { uz, en, ru };

function readStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  return normalizeLocale(localStorage.getItem("private-locale"));
}

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const { data, hasLoaded } = useAppData();
  const locale = useMemo(() => {
    if (hasLoaded) {
      return normalizeLocale(data.language);
    }

    return readStoredLocale();
  }, [data.language, hasLoaded]);

  useEffect(() => {
    localStorage.setItem("private-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages[locale]} timeZone="Asia/Tashkent">
      {children}
    </NextIntlClientProvider>
  );
}
