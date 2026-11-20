import type { Difficulty } from './types';

/** One in-progress puzzle per puzzle type, so it can be resumed from Labs. */
export interface Save {
  seed: number;
  level: Difficulty;
  elapsed: number;
  mistakes: number;
  state: unknown;
  at: number;
  /** Locale the puzzle was generated in (matters for word games). */
  locale?: 'en' | 'fr';
}

const KEY = 'puzzle-express:saves:v1';

function read(): Record<string, Save> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function write(all: Record<string, Save>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota: resume is best-effort */
  }
}

export const getSave = (id: string): Save | undefined => read()[id];
export const allSaves = () => read();

export function putSave(id: string, s: Save) {
  const all = read();
  all[id] = s;
  write(all);
}

/** Remove the save for `id`; if `seed` is given, only when it belongs to that puzzle. */
export function clearSave(id: string, seed?: number) {
  const all = read();
  if (!all[id] || (seed != null && all[id].seed !== seed)) return;
  delete all[id];
  write(all);
}

export function clearAllSaves() {
  write({});
}
