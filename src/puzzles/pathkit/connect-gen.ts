import type { Rng } from '../../core/rng';
import { byLevel, type Difficulty } from '../../core/types';
import { adjacent, nbrs } from './grid';

export interface ConnectPuzzle {
  n: number;
  /** One solution: a path per colour, endpoints are the dots. */
  paths: number[][];
}

/** Random Hamiltonian path on an n x n grid: serpentine start, then many backbite moves. */
function hamiltonPath(rng: Rng, n: number, moves: number): number[] {
  let path: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - 1 - c : c));
  const pos = new Int32Array(n * n);
  const reindex = () => path.forEach((v, i) => (pos[v] = i));
  reindex();
  for (let m = 0; m < moves; m++) {
    if (rng.chance(0.5)) {
      path.reverse();
      reindex();
    }
    // backbite at the head (index 0)
    const head = path[0];
    const opts = nbrs(head, n, n).filter((x) => x !== path[1]);
    if (!opts.length) continue;
    const j = pos[rng.pick(opts)];
    // join head to path[j]; path[j-1] becomes the new head
    const front = path.slice(0, j).reverse();
    path = front.concat(path.slice(j));
    for (let k = 0; k < j; k++) pos[path[k]] = k;
  }
  return path;
}

export function genConnect(rng: Rng, d: Difficulty): ConnectPuzzle {
  const n = byLevel(d, [5, 6, 7, 8, 9]);
  const k = byLevel(d, [4, 5, 6, 7, 8]);
  const N = n * n;
  for (let attempt = 0; attempt < 40; attempt++) {
    const path = hamiltonPath(rng, n, N * 25);
    // random cut points, every segment >= 3 cells
    for (let t = 0; t < 60; t++) {
      const cuts = new Set<number>();
      while (cuts.size < k - 1) cuts.add(rng.int(3, N - 3));
      const sorted = [0, ...[...cuts].sort((a, b) => a - b), N];
      let ok = true;
      const segs: number[][] = [];
      for (let i = 0; i + 1 < sorted.length && ok; i++) {
        const seg = path.slice(sorted[i], sorted[i + 1]);
        if (seg.length < 3 || adjacent(seg[0], seg[seg.length - 1], n)) ok = false;
        // avoid one colour hogging the board
        if (seg.length > Math.max(6, (N / k) * 2.2)) ok = false;
        segs.push(seg);
      }
      if (ok) return { n, paths: segs };
    }
  }
  // Fallback: equal cuts of a serpentine (always valid for these sizes).
  const path = hamiltonPath(rng, n, 0);
  const segs: number[][] = [];
  const len = Math.floor(N / k);
  for (let i = 0; i < k; i++) segs.push(path.slice(i * len, i === k - 1 ? N : (i + 1) * len));
  return { n, paths: segs };
}
