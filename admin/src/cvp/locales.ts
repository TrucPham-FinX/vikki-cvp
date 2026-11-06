/**
 * The CVP's languages: what `?lang` picks on a page (runtime/README.md) and what a data file of a
 * page built per language is named after (front-end/build.js, LOCALES).
 */
export const LOCALES = ['vi', 'en', 'ko'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'vi'

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ko: '한국어',
}

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale)
