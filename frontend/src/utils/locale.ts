import i18n from '../i18n/config';

/**
 * BCP 47 locale for date/number formatting that matches the UI language
 * (Spanish default, English secondary).
 *
 * @param language - i18next language code; defaults to the active one.
 */
export function dateLocale(language: string | undefined = i18n.language): string {
  return language?.startsWith('en') ? 'en-US' : 'es-ES';
}
