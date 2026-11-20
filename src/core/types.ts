import type { CategoryId } from './categories';
import { L } from './i18n';
import type { Rng } from './rng';

export type Difficulty = 1 | 2 | 3 | 4 | 5;
export const LEVELS: Difficulty[] = [1, 2, 3, 4, 5];
export const LEVEL_NAMES: Record<Difficulty, string> = {
  get 1() {
    return L('Easy', 'Facile');
  },
  get 2() {
    return L('Medium', 'Moyen');
  },
  get 3() {
    return L('Hard', 'Difficile');
  },
  get 4() {
    return L('Expert', 'Expert');
  },
  get 5() {
    return L('Master', 'Maître');
  },
};

/**
 * How-to-play content shown behind the card's "?" button. Write it with L(en, fr).
 * @public
 */
export interface Help {
  /** One or two sentences: what you're trying to achieve. */
  goal: string;
  /** Numbered steps: how to play and the controls (tap, drag, keys). */
  steps: string[];
  /** Optional strategy hints. */
  tips?: string[];
}

export interface PuzzleCtx {
  difficulty: Difficulty;
  rng: Rng;
  /** Puzzle content goes here. */
  root: HTMLElement;
  /** Call once when the puzzle is completed. */
  solved(): void;
  /** Call once when the puzzle can no longer be completed (out of moves/lives). */
  failed(): void;
  /** Count a wrong move. */
  mistake(): void;
  /** Mark that the player has started interacting. */
  touch(): void;
  /** Short status line shown in the card footer. */
  status(text: string): void;
  /** Extra buttons shown in the card footer. */
  controls(...els: HTMLElement[]): void;
  /** State previously returned by `snapshot()` when resuming; same seed, so generation matches. */
  saved?: unknown;
}

export interface PuzzleInstance {
  /** Card became the visible one. Called on every activation. */
  activate?(): void;
  /** Keyboard input while this card is active. Return true if handled. */
  onKey?(e: KeyboardEvent): boolean;
  /** Serializable progress, restored through `ctx.saved`. */
  snapshot?(): unknown;
  destroy?(): void;
}

export interface PuzzleDef {
  id: string;
  name: string;
  /** One short line shown under the title. */
  rules: string;
  category: CategoryId;
  /** Tutorial (localised via L()). */
  help?: () => Help;
  /** Content depends on the locale (word games): saves from another locale aren't resumed. */
  localized?: boolean;
  /** Target solve time in seconds at a given difficulty; used for auto-levelling. */
  par: (d: Difficulty) => number;
  create(ctx: PuzzleCtx): PuzzleInstance | void;
}

/** Pick per-difficulty value from a 5-tuple. */
export const byLevel = <T>(d: Difficulty, values: readonly [T, T, T, T, T]): T => values[d - 1];
