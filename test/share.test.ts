// @vitest-environment happy-dom
import { afterAll, describe, expect, it } from 'vitest';
import { _setLocaleForTests } from '../src/core/i18n';
import { decodeCode, encodeCode, resolveCode } from '../src/core/share';
import { PUZZLES } from '../src/puzzles';

afterAll(() => _setLocaleForTests('en'));

describe('share codes', () => {
  it('round-trips game, level, seed and locale', () => {
    for (const id of ['sudoku', 'cross-sums', 'word-guess']) {
      for (const seed of [0, 1, 123_456_789, 0xffffffff]) {
        for (const locale of [undefined, 'fr' as const]) {
          const c = { id, level: 3 as const, seed, ...(locale ? { locale } : {}) };
          expect(decodeCode(encodeCode(c))).toEqual(c);
        }
      }
    }
    expect(encodeCode({ id: 'sudoku', level: 5, seed: 0xffffffff })).toBe('sudoku-5-1z141z3');
  });

  it('works for every game id', () => {
    for (const p of PUZZLES) expect(decodeCode(encodeCode({ id: p.id, level: 2, seed: 42 }))?.id, p.id).toBe(p.id);
  });

  it('accepts links, spaces and capitals', () => {
    expect(decodeCode('  Sudoku-2-ABC ')).toEqual({ id: 'sudoku', level: 2, seed: parseInt('abc', 36) });
    expect(decodeCode('https://puzzle.garand.dev/#/s/anagram-1-z-fr')).toEqual({ id: 'anagram', level: 1, seed: 35, locale: 'fr' });
  });

  it('rejects malformed codes', () => {
    for (const bad of ['', 'sudoku', 'sudoku-6-abc', 'sudoku-0-abc', 'sudoku-3-', 'sudoku-3-zzzzzzzz', 'sudoku-3-2000000', 'sudoku-3-a!'])
      expect(decodeCode(bad), bad).toBeNull();
  });

  it('resolves to a game, or explains why not', () => {
    _setLocaleForTests('en');
    const ok = resolveCode('killer-sudoku-4-xyz', PUZZLES);
    expect('def' in ok && ok.def.id).toBe('killer-sudoku');
    expect('error' in resolveCode('nope-1-a', PUZZLES)).toBe(true);
    expect('error' in resolveCode('garbage', PUZZLES)).toBe(true);
    // Word games are tied to the locale's word list.
    expect('error' in resolveCode('anagram-1-a-fr', PUZZLES)).toBe(true);
    expect('def' in resolveCode('anagram-1-a', PUZZLES)).toBe(true);
    _setLocaleForTests('fr');
    expect('def' in resolveCode('anagram-1-a-fr', PUZZLES)).toBe(true);
  });
});
