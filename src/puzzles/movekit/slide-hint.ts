/**
 * Shortest solution of a sliding-tile board (0 = gap), for the guide. Returns the cells whose tile
 * slides into the gap, in order, or null when the search runs out of budget.
 */
export function solveSlide(tiles: number[], n: number, cap = 250000): number[] | null {
  const goal = tiles.map((_, i) => (i + 1) % (n * n)).join(',');
  const start = tiles.join(',');
  if (start === goal) return [];
  const prev = new Map<string, [string, number]>([[start, ['', -1]]]);
  const q: number[][] = [tiles.slice()];
  for (let k = 0; k < q.length; k++) {
    const t = q[k];
    const key = t.join(',');
    const gap = t.indexOf(0);
    const r = Math.floor(gap / n),
      c = gap % n;
    const opts = [r > 0 ? gap - n : -1, r < n - 1 ? gap + n : -1, c > 0 ? gap - 1 : -1, c < n - 1 ? gap + 1 : -1];
    for (const x of opts) {
      if (x < 0) continue;
      const nt = t.slice();
      nt[gap] = nt[x];
      nt[x] = 0;
      const nk = nt.join(',');
      if (prev.has(nk)) continue;
      prev.set(nk, [key, x]);
      if (nk === goal) {
        const path: number[] = [];
        for (let s = nk; s !== start;) {
          const [p, m] = prev.get(s)!;
          path.unshift(m);
          s = p;
        }
        return path;
      }
      if (prev.size > cap) return null;
      q.push(nt);
    }
  }
  return null;
}
