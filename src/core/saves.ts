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
  /** The goal was reached and the solve already recorded (endless games playing on). */
  reached?: true;
}

const KEY = 'puzzle-express:saves:v1';
/** Puzzles opened from a share code live in their own slot, so they never overwrite your own game. */
const SHARED_KEY = 'puzzle-express:shared:v1';

function read(key = KEY): Record<string, Save> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function write(all: Record<string, Save>, key = KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* quota: resume is best-effort */
  }
}

export const getSave = (id: string, shared = false): Save | undefined => read(shared ? SHARED_KEY : KEY)[id];
export const allSaves = () => read();

export function putSave(id: string, s: Save, shared = false) {
  const key = shared ? SHARED_KEY : KEY;
  const all = read(key);
  all[id] = s;
  write(all, key);
}

/** Remove the save for `id`; if `seed` is given, only when it belongs to that puzzle. */
export function clearSave(id: string, seed?: number, shared = false) {
  const key = shared ? SHARED_KEY : KEY;
  const all = read(key);
  if (!all[id] || (seed != null && all[id].seed !== seed)) return;
  delete all[id];
  write(all, key);
}

export function clearAllSaves() {
  write({});
  write({}, SHARED_KEY);
}
