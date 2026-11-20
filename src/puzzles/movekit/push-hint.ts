import { stepper } from './pushgen';

export interface PushStep {
  /** Crate cell before the push. */
  box: number;
  /** 0 up, 1 right, 2 down, 3 left. */
  dir: number;
}

/**
 * Fewest-pushes solution from the current position, for the guide: the list of pushes, or null when
 * none is found within the budget. Crates in non-target corners are pruned.
 */
export function solvePush(
  w: number,
  h: number,
  floor: boolean[],
  targets: number[],
  boxes: number[],
  player: number,
  cap = 120000,
): PushStep[] | null {
  const nb = stepper(w, h);
  const tset = new Set(targets);
  const wall = (i: number) => i < 0 || !floor[i];
  const dead = (i: number) => {
    if (tset.has(i)) return false;
    const v = wall(nb(i, 0)) || wall(nb(i, 2));
    const hz = wall(nb(i, 1)) || wall(nb(i, 3));
    return v && hz;
  };
  const reach = (p: number, bx: number[]) => {
    const seen = new Uint8Array(w * h);
    const q = [p];
    seen[p] = 1;
    for (let k = 0; k < q.length; k++)
      for (let d = 0; d < 4; d++) {
        const y = nb(q[k], d);
        if (wall(y) || seen[y] || bx.includes(y)) continue;
        seen[y] = 1;
        q.push(y);
      }
    return { seen, min: Math.min(...q) };
  };
  const keyOf = (bx: number[], p: number) => `${[...bx].sort((a, b) => a - b).join(',')}|${reach(p, bx).min}`;
  const k0 = keyOf(boxes, player);
  const prev = new Map<string, { from: string; step: PushStep } | null>([[k0, null]]);
  const q: { bx: number[]; p: number; key: string }[] = [{ bx: boxes.slice(), p: player, key: k0 }];
  if (boxes.every((b) => tset.has(b))) return [];
  for (let k = 0; k < q.length; k++) {
    const { bx, p, key } = q[k];
    const { seen } = reach(p, bx);
    for (let bi = 0; bi < bx.length; bi++) {
      const b = bx[bi];
      for (let d = 0; d < 4; d++) {
        const behind = nb(b, (d + 2) % 4);
        const to = nb(b, d);
        if (behind < 0 || !seen[behind] || wall(to) || bx.includes(to) || dead(to)) continue;
        const nbx = bx.slice();
        nbx[bi] = to;
        const nk = keyOf(nbx, b);
        if (prev.has(nk)) continue;
        prev.set(nk, { from: key, step: { box: b, dir: d } });
        if (nbx.every((x) => tset.has(x))) {
          const path: PushStep[] = [];
          for (let s = nk; s !== k0;) {
            const e = prev.get(s)!;
            path.unshift(e.step);
            s = e.from;
          }
          return path;
        }
        if (prev.size > cap) return null;
        q.push({ bx: nbx, p: b, key: nk });
      }
    }
  }
  return null;
}
