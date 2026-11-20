import type { Rng } from '../../core/rng';
import { byLevel, type Difficulty } from '../../core/types';
import { ORTHO } from './grid';

export interface GemsPuzzle {
  n: number;
  rock: Uint8Array;
  start: number;
  gems: number[];
  /** Fewest moves to collect everything. */
  best: number;
  /** Move limit, or 0 for none. */
  limit: number;
}

/** Slide from i in direction dir; returns the cells passed through (excluding i). */
export function slide(n: number, rock: Uint8Array, i: number, dir: number): number[] {
  const [dr, dc] = ORTHO[dir];
  let r = Math.floor(i / n),
    c = i % n;
  const out: number[] = [];
  for (;;) {
    const rr = r + dr,
      cc = c + dc;
    if (rr < 0 || rr >= n || cc < 0 || cc >= n || rock[rr * n + cc]) break;
    r = rr;
    c = cc;
    out.push(r * n + c);
  }
  return out;
}

/** BFS over (position, collected mask). Returns fewest moves, or -1. */
function solveGems(n: number, rock: Uint8Array, start: number, gems: number[]): number {
  const G = gems.length;
  const gemBit = new Int32Array(n * n).fill(0);
  gems.forEach((g, k) => (gemBit[g] = 1 << k));
  const N = n * n;
  const endAt = new Int32Array(N * 4).fill(-1);
  const maskAt = new Int32Array(N * 4);
  for (let i = 0; i < N; i++) {
    if (rock[i]) continue;
    for (let d = 0; d < 4; d++) {
      const s = slide(n, rock, i, d);
      if (!s.length) continue;
      endAt[i * 4 + d] = s[s.length - 1];
      maskAt[i * 4 + d] = s.reduce((m, x) => m | gemBit[x], 0);
    }
  }
  const full = (1 << G) - 1;
  const dist = new Int16Array(N << G).fill(-1);
  const q = new Int32Array(N << G);
  let head = 0,
    tail = 0;
  // the start cell never holds a gem, so we begin with an empty mask
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const st = q[head++];
    const m = Math.floor(st / N),
      i = st % N;
    const dd = dist[st];
    if (m === full) return dd;
    for (let d = 0; d < 4; d++) {
      const e = endAt[i * 4 + d];
      if (e < 0) continue;
      const ns = (m | maskAt[i * 4 + d]) * N + e;
      if (dist[ns] < 0) {
        dist[ns] = dd + 1;
        q[tail++] = ns;
      }
    }
  }
  return -1;
}

export function genGems(rng: Rng, d: Difficulty): GemsPuzzle {
  const n = byLevel(d, [6, 7, 8, 9, 10]);
  const rockP = byLevel(d, [0.1, 0.12, 0.14, 0.15, 0.16]);
  const G = byLevel(d, [3, 5, 6, 8, 10]);
  const walk = byLevel(d, [5, 8, 11, 14, 18]);
  const minBest = byLevel(d, [3, 4, 6, 8, 10]);
  const slack = byLevel(d, [0, 0, 0, 3, 1]);
  const N = n * n;
  let fallback: GemsPuzzle | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const rock = new Uint8Array(N);
    for (let i = 0; i < N; i++) rock[i] = rng.chance(rockP) ? 1 : 0;
    const free = Array.from({ length: N }, (_, i) => i).filter((i) => !rock[i]);
    const start = rng.pick(free);
    // random walk of slides; gems go on cells it passes
    const seen: number[] = [];
    let at = start,
      lastDir = -1;
    for (let k = 0; k < walk; k++) {
      const opts = [0, 1, 2, 3].filter((dir) => dir !== (lastDir + 2) % 4 && slide(n, rock, at, dir).length);
      if (!opts.length) break;
      const dir = rng.pick(opts);
      const s = slide(n, rock, at, dir);
      // prefer recording the stopping cell, plus some pass-through cells
      for (const x of s) if (x !== start && (x === s[s.length - 1] || rng.chance(0.35))) seen.push(x);
      at = s[s.length - 1];
      lastDir = dir;
    }
    const cand = rng.shuffle([...new Set(seen)]);
    if (cand.length < G) continue;
    const gems = cand.slice(0, G);
    const best = solveGems(n, rock, start, gems);
    if (best < 0) continue;
    const p: GemsPuzzle = { n, rock, start, gems, best, limit: slack ? best + slack : 0 };
    if (best >= minBest) return p;
    if (!fallback || best > fallback.best) fallback = p;
  }
  if (fallback) return fallback;
  // Last resort: open board, gems along the edges.
  const rock = new Uint8Array(N);
  const gems = [n - 1, N - 1, N - n].slice(0, Math.min(3, G));
  return { n, rock, start: 0, gems, best: solveGems(n, rock, 0, gems), limit: 0 };
}
