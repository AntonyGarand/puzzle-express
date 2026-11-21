/**
 * Two locales: English and Québec French. Strings live next to the code that uses them:
 *   L('Undo', 'Annuler')
 * The locale is read once at startup; switching reloads the page (progress is saved on pagehide).
 */
export type Locale = 'en' | 'fr';

export const LOCALES: { id: Locale; name: string; tag: string }[] = [
  { id: 'en', name: 'English', tag: 'en-CA' },
  { id: 'fr', name: 'Français (Québec)', tag: 'fr-CA' },
];

const KEY = 'puzzle-express:locale';

function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    /* storage unavailable */
  }
  const langs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  return langs.some((l) => l?.toLowerCase().startsWith('fr')) ? 'fr' : 'en';
}

let current: Locale = detect();

export const locale = (): Locale => current;

// Word games normally draw from the interface language's word list. A shared puzzle from the other
// language overrides it while that puzzle is on screen, so the interface stays in yours.
let words: Locale | null = null;

/** The language word games generate from and check words against. */
export const wordLocale = (): Locale => words ?? current;

/** Play word games in `l`'s word list (null: back to the interface language). */
export function setWordLocale(l: Locale | null) {
  words = l === current ? null : l;
}
export const localeTag = () => LOCALES.find((l) => l.id === current)!.tag;

/** Pick the string for the current locale. */
export const L = (en: string, fr: string): string => (current === 'fr' ? fr : en);

/** Plural helper: P(n, ['move', 'moves'], ['coup', 'coups']) → "3 moves" / "3 coups". */
export const P = (n: number, en: [string, string], fr: [string, string]): string => {
  const [one, many] = current === 'fr' ? fr : en;
  // French uses the singular for 0 and 1.
  const single = current === 'fr' ? Math.abs(n) < 2 : n === 1;
  return `${n} ${single ? one : many}`;
};

export function setLocale(l: Locale) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  if (l !== current) {
    current = l;
    window.dispatchEvent(new Event('pagehide')); // flush in-progress saves before reloading
    location.reload();
  }
}

/** For tests only. */
export function _setLocaleForTests(l: Locale) {
  current = l;
}
