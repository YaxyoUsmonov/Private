export const locales = ["uz", "en", "ru"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uz";

export const localeLabels: Record<Locale, string> = {
  uz: "O'zbekcha",
  en: "English",
  ru: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
};

export const legacyLanguageToLocale: Record<string, Locale> = {
  Ozbekcha: "uz",
  "O'zbekcha": "uz",
  Uzbek: "uz",
  English: "en",
  "\u0420\u0443\u0441\u0441\u043a\u0438\u0439": "ru",
};

export function normalizeLocale(value?: string | null): Locale {
  if (!value) {
    return defaultLocale;
  }

  if ((locales as readonly string[]).includes(value)) {
    return value as Locale;
  }

  return legacyLanguageToLocale[value] ?? defaultLocale;
}
