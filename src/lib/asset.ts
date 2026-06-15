const BASE = import.meta.env.BASE_URL;

/**
 * URL до файлу з public/, з урахуванням Vite `base`.
 * Потрібно, бо застосунок звертається до ассетів у рантаймі (fetch, <img>, CSS),
 * а під GitHub Pages сайт живе за під-шляхом `/<repo>/`, не в корені.
 */
export function asset(path: string): string {
  return BASE + path.replace(/^\/+/, '');
}
