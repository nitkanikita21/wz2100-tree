import { createI18n } from 'vue-i18n';
import uk from './uk';
import en from './en';

export const SUPPORTED_LOCALES = ['uk', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = 'wz-locale';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Збережений вибір -> мова браузера (uk* -> uk) -> en. */
function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // localStorage недоступний (приватний режим тощо) — ігноруємо.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return nav.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { uk, en },
  // Невідомий ключ (напр. новий research-токен після апдейту гри) -> сам токен.
  missing: (_locale, key) => key.split('.').pop() ?? key,
  missingWarn: false,
  fallbackWarn: false,
});

/** Перемикач мови: оновлює композер, localStorage і <html lang>. */
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale);
  }
}

/** Поточна мова (для перемикача). */
export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale;
}

/** Глобальний переклад для коду поза компонентами (стори). */
export function globalT(key: string, named?: Record<string, unknown>): string {
  return named ? i18n.global.t(key, named) : i18n.global.t(key);
}

// Виставляємо <html lang> на старті відповідно до визначеної мови.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', i18n.global.locale.value);
}
