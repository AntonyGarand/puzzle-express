import { rank, type Card } from './cards';

/** Pyramid rules engine + DFS solver (pure; no DOM). */
export interface PState {
  pyr: number[]; // 28 slots, -1 = removed; row r, col k at r*(r+1)/2 + k
  stock: Card[]; // top = end
  waste: Card[]; // top = end
  passes: number; // redeals used
  moves: number;
}

const ROW = (i: number) => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
export const idx = (r: number, k: number) => (r * (r + 1)) / 2 + k;

export function dealP(cards: Card[]): PState {
  return { pyr: cards.slice(0, 28), stock: cards.slice(28), waste: [], passes: 0, moves: 0 };
}
export function exposed(pyr: number[], i: number): boolean {
  if (pyr[i] < 0) return false;
  const r = ROW(i);
  if (r === 6) return true;
  const k = i - idx(r, 0);
  return pyr[idx(r + 1, k)] < 0 && pyr[idx(r + 1, k + 1)] < 0;
}

/** Card at an available position: 'p#' (exposed pyramid card) or 'w' (waste top). */
export function cardAt(s: PState, p: string): Card | null {
  if (p === 'w') return s.waste.length ? s.waste[s.waste.length - 1] : null;
  if (p[0] === 'p') {
    const i = Number(p.slice(1));
    return exposed(s.pyr, i) ? s.pyr[i] : null;
  }
  return null;
}

const take = (s: PState, p: string) => {
  if (p === 'w') s.waste.pop();
  else s.pyr[Number(p.slice(1))] = -1;
};

/** Remove a king alone, or a pair summing to 13. */
export function removeP(s: PState, a: string, b?: string, dry = false): boolean {
  const ca = cardAt(s, a);
  if (ca == null) return false;
  if (b == null) {
    if (rank(ca) !== 13) return false;
    if (!dry) {
      take(s, a);
      s.moves++;
    }
    return true;
  }
  if (a === b) return false;
  const cb = cardAt(s, b);
  if (cb == null || rank(ca) + rank(cb) !== 13) return false;
  if (!dry) {
    take(s, a);
    take(s, b);
    s.moves++;
  }
  return true;
}

export const canRecycle = (s: PState, maxPasses: number) =>
  !s.stock.length && s.waste.length > 0 && (maxPasses < 0 || s.passes < maxPasses - 1);

export function drawP(s: PState, maxPasses: number): boolean {
  if (s.stock.length) s.waste.push(s.stock.pop()!);
  else if (canRecycle(s, maxPasses)) {
    s.stock = s.waste.reverse();
    s.waste = [];
    s.passes++;
  } else return false;
  s.moves++;
  return true;
}

export const clearedP = (s: PState) => s.pyr.every((c) => c < 0);

function availableP(s: PState): string[] {
  const out: string[] = [];
  for (let i = 0; i < 28; i++) if (exposed(s.pyr, i)) out.push('p' + i);
  if (s.waste.length) out.push('w');
  return out;
}

function anyPairP(s: PState): boolean {
  const av = availableP(s);
  for (let x = 0; x < av.length; x++) {
    const cx = cardAt(s, av[x])!;
    if (rank(cx) === 13) return true;
    for (let y = x + 1; y < av.length; y++) if (rank(cx) + rank(cardAt(s, av[y])!) === 13) return true;
  }
  return false;
}

/** Can the pyramid still be cleared? */
export const stuckP = (s: PState, maxPasses: number) => !s.stock.length && !canRecycle(s, maxPasses) && !anyPairP(s);

/**
 * DFS: can the pyramid be cleared from the initial deal with `passes` passes through the stock?
 * False if unsolvable or the node budget ran out.
 */
export function solveP(s0: PState, passes: number, budget = 20000): boolean {
  const talon = s0.stock.slice().reverse(); // draw order
  const T = talon.length;
  const pyr0 = s0.pyr;
  const seen = new Set<string>();
  let pm = 0; // removed pyramid bits
  let tm = 0; // removed talon bits
  let nodes = 0;
  const pyr = pyr0.slice();
  const tal = new Array<boolean>(T).fill(false); // removed
  const exp = (i: number) => exposed(pyr, i);

  const rec = (ptr: number, pass: number, left: number): boolean => {
    if (left === 0) return true;
    if (++nodes > budget) return false;
    const key = pm * 16777216 + tm + ':' + (ptr * 8 + pass);
    if (seen.has(key)) return false;
    seen.add(key);
    // waste top
    let w = ptr - 1;
    while (w >= 0 && tal[w]) w--;
    const av: number[] = [];
    for (let i = 0; i < 28; i++) if (exp(i)) av.push(i);
    // kings
    for (const i of av) {
      if (rank(pyr[i]) === 13) {
        const c = pyr[i];
        pyr[i] = -1;
        pm += 2 ** i;
        const ok = rec(ptr, pass, left - 1);
        pyr[i] = c;
        pm -= 2 ** i;
        return ok; // removing a king is always safe
      }
    }
    if (w >= 0 && rank(talon[w]) === 13) {
      tal[w] = true;
      tm += 2 ** w;
      const ok = rec(ptr, pass, left);
      tal[w] = false;
      tm -= 2 ** w;
      return ok;
    }
    // pyramid pairs
    for (let x = 0; x < av.length; x++) {
      for (let y = x + 1; y < av.length; y++) {
        const a = av[x],
          b = av[y];
        if (rank(pyr[a]) + rank(pyr[b]) !== 13) continue;
        const ca = pyr[a],
          cb = pyr[b];
        pyr[a] = -1;
        pyr[b] = -1;
        pm += 2 ** a + 2 ** b;
        const ok = rec(ptr, pass, left - 2);
        pyr[a] = ca;
        pyr[b] = cb;
        pm -= 2 ** a + 2 ** b;
        if (ok) return true;
      }
    }
    // waste + pyramid
    if (w >= 0) {
      for (const a of av) {
        if (rank(pyr[a]) + rank(talon[w]) !== 13) continue;
        const ca = pyr[a];
        pyr[a] = -1;
        tal[w] = true;
        pm += 2 ** a;
        tm += 2 ** w;
        const ok = rec(ptr, pass, left - 1);
        pyr[a] = ca;
        tal[w] = false;
        pm -= 2 ** a;
        tm -= 2 ** w;
        if (ok) return true;
      }
    }
    // draw
    let nx = ptr;
    while (nx < T && tal[nx]) nx++;
    if (nx < T) return rec(nx + 1, pass, left);
    if (pass < passes - 1 && tal.some((r) => !r)) return rec(0, pass + 1, left);
    return false;
  };
  return rec(0, 0, pyr0.filter((c) => c >= 0).length);
}
