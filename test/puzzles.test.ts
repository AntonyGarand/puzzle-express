// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { LEVELS, type PuzzleCtx } from '../src/core/types';
import { PUZZLES } from '../src/puzzles';
import { WORDS } from '../src/puzzles/words';

// happy-dom lacks a few APIs some puzzles touch.
(globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} };
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

function ctx(d: (typeof LEVELS)[number], seed: number) {
  const root = document.createElement('div');
  const events: string[] = [];
  const c: PuzzleCtx = {
    difficulty: d,
    rng: new Rng(seed),
    root,
    solved: () => events.push('solved'),
    failed: () => events.push('failed'),
    mistake: () => events.push('mistake'),
    touch: () => {},
    status: () => {},
    controls: () => {},
  };
  return { c, root, events };
}

describe.each(PUZZLES.map((p) => [p.id, p] as const))('%s', (_id, def) => {
  it.each(LEVELS)('generates quickly and unsolved at level %i', (d) => {
    for (let seed = 1; seed <= 15; seed++) {
      const { c, root, events } = ctx(d, seed * 7919 + d);
      const t = performance.now();
      const inst = def.create(c) || {};
      const ms = performance.now() - t;
      expect(ms, `seed ${seed} took ${ms.toFixed(0)}ms`).toBeLessThan(1500);
      expect(root.childElementCount).toBeGreaterThan(0);
      expect(events).toEqual([]);
      inst.destroy?.();
    }
  });
});

describe('words', () => {
  it('has enough words of every anagram length', () => {
    for (const len of [4, 5, 6, 7, 8]) expect(WORDS[len].length).toBeGreaterThan(80);
  });
});
