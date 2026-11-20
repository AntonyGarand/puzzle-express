import type { Rng } from '../../core/rng';

/** A board as columns of colours, bottom first; empty columns are dropped (everything is packed left). */
export type Cols = number[][];

/** Cells of the same-colour group at (x, y), as [x, y] pairs. */
export function groupAt(cols: Cols, x: number, y: number): [number, number][] {
  const c = cols[x]?.[y];
  if (c == null) return [];
  const seen = new Set([`${x},${y}`]);
  const out: [number, number][] = [];
  const st: [number, number][] = [[x, y]];
  while (st.length) {
    const [a, b] = st.pop()!;
    out.push([a, b]);
    for (const [u, v] of [
      [a - 1, b],
      [a + 1, b],
      [a, b - 1],
      [a, b + 1],
    ]) {
      if (cols[u]?.[v] !== c || seen.has(`${u},${v}`)) continue;
      seen.add(`${u},${v}`);
      st.push([u, v]);
    }
  }
  return out;
}

/** Remove a set of cells, let the rest fall and slide empty columns left. */
export function removeCells(cols: Cols, cells: [number, number][]): Cols {
  const gone = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cols.map((col, x) => col.filter((_, y) => !gone.has(`${x},${y}`))).filter((col) => col.length);
}

/** Is there any group of 2 or more left? */
export function hasMove(cols: Cols): boolean {
  return cols.some((col, x) => col.some((c, y) => col[y + 1] === c || cols[x + 1]?.[y] === c));
}

/**
 * Solvable board, built backwards: start empty and repeatedly insert a connected group (pushing the
 * blocks above it up, or adding a new column), keeping it apart from same-coloured blocks. Removing
 * the groups in reverse order then clears the board. Returns the board and that clearing order.
 */
export function genCollapse(rng: Rng, W: number, H: number, k: number): { cols: Cols; solution: [number, number][] } {
  let best: { cols: Cols; steps: [number, number][] } = { cols: [], steps: [] };
  const sizes = [2, 2, 2, 2, 3, 3, 3, 4, 4, 5];
  for (let attempt = 0; attempt < 30; attempt++) {
    let cols: Cols = [];
    // one cell of each inserted group, in the board right after that insertion
    const steps: [number, number][] = [];
    let total = 0;
    for (let tries = 0; tries < 4000 && total < W * H; tries++) {
      const room = W * H - total;
      if (room < 2) break;
      let s = Math.min(rng.pick(sizes), room);
      if (room - s === 1) s++; // never leave a single cell to fill
      const c = rng.int(0, k - 1);
      const m = cols.length;
      // span over 1..3 columns, possibly one of them new
      const w = rng.int(1, Math.min(3, s));
      const fresh = m < W && rng.chance(m === 0 ? 1 : 0.25) ? rng.int(0, w - 1) : -1;
      const existing = fresh >= 0 ? w - 1 : w;
      if (existing > m) continue;
      const x0 = rng.int(0, m - existing);
      // split s cells into w runs (each at least 1)
      const runs = new Array<number>(w).fill(1);
      for (let r = w; r < s; r++) runs[rng.int(0, w - 1)]++;
      const next = cols.map((col) => col.slice());
      if (fresh >= 0) next.splice(x0 + fresh, 0, []);
      let ok = true;
      let prevH = -1,
        prevK = 0;
      const placed: [number, number][] = [];
      for (let i = 0; i < w && ok; i++) {
        const col = next[x0 + i];
        const kk = runs[i];
        if (col.length + kk > H) {
          ok = false;
          break;
        }
        let lo = 0,
          hi = col.length;
        if (i > 0) {
          lo = Math.max(lo, prevH - kk + 1);
          hi = Math.min(hi, prevH + prevK - 1);
        }
        if (lo > hi) {
          ok = false;
          break;
        }
        // lean towards low insertions so the colours mix through the whole column
        const hh = Math.min(rng.int(lo, hi), rng.int(lo, hi));
        col.splice(hh, 0, ...new Array<number>(kk).fill(c));
        for (let y = hh; y < hh + kk; y++) placed.push([x0 + i, y]);
        prevH = hh;
        prevK = kk;
      }
      if (!ok) continue;
      if (groupAt(next, placed[0][0], placed[0][1]).length !== s) continue;
      cols = next;
      total += s;
      steps.push(placed[0]);
    }
    if (total > best.cols.reduce((a, col) => a + col.length, 0)) best = { cols, steps };
    if (total === W * H) break;
  }
  return { cols: best.cols, solution: best.steps.reverse() };
}
