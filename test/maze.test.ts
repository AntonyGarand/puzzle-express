import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { genMaze, mazeStats } from '../src/puzzles/pathkit/maze-gen';

// Same tuning as src/puzzles/maze.ts.
const LEVELS = [
  { size: 6, newest: 0.8, braid: 0 },
  { size: 9, newest: 0.75, braid: 0 },
  { size: 12, newest: 0.7, braid: 0.06 },
  { size: 15, newest: 0.65, braid: 0.1 },
  { size: 19, newest: 0.6, braid: 0.15 },
];

describe('maze generator', () => {
  it.each(LEVELS.map((t, i) => [i + 1, t] as const))('level %i offers real choices along the route', (_lvl, t) => {
    let decisions = 0;
    let length = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const open = genMaze(new Rng(seed), { ...t, tries: 8 });
      const st = mazeStats(open, t.size);
      decisions += st.decisions;
      length += st.pathLength;
    }
    // The old recursive backtracker averaged ~1 decision per 10–12 route cells; require at least 1 per 4.
    expect(decisions / length).toBeGreaterThan(0.25);
  });
});
