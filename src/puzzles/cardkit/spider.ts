import { rank, suit, type Card } from './cards';

/** Spider rules engine (pure; no DOM). */
interface SCol {
  d: Card[];
  u: Card[];
}
export interface SState {
  cols: SCol[];
  stock: Card[]; // top = end
  done: number[]; // suits of completed K→A runs
  moves: number;
}

export function dealS(cards: Card[], ncols: number, dealt: number): SState {
  const c = cards.slice();
  const cols: SCol[] = Array.from({ length: ncols }, () => ({ d: [], u: [] }));
  for (let i = 0; i < dealt; i++) cols[i % ncols].d.push(c.pop()!);
  for (const col of cols) col.u.push(col.d.pop()!);
  return { cols, stock: c, done: [], moves: 0 };
}

const seqOk = (a: Card, b: Card) => suit(a) === suit(b) && rank(a) === rank(b) + 1;

/** Index (within u) where the movable same-suit run at the top starts. */
function runStartS(u: Card[]): number {
  let k = u.length - 1;
  while (k > 0 && seqOk(u[k - 1], u[k])) k--;
  return Math.max(0, k);
}

export function pickedS(s: SState, p: string, i: number): Card[] | null {
  if (p[0] !== 't') return null;
  const col = s.cols[Number(p.slice(1))];
  if (!col) return null;
  const k = i - col.d.length;
  if (k < 0 || k >= col.u.length || k < runStartS(col.u)) return null;
  return col.u.slice(k);
}

const fitsS = (col: SCol, c: Card) => (col.u.length ? rank(col.u[col.u.length - 1]) === rank(c) + 1 : !col.d.length);

function settle(s: SState, col: SCol) {
  if (col.u.length >= 13) {
    const tail = col.u.slice(-13);
    if (rank(tail[0]) === 13 && tail.every((c, j) => j === 0 || seqOk(tail[j - 1], c))) {
      col.u.splice(-13);
      s.done.push(suit(tail[0]));
    }
  }
  if (!col.u.length && col.d.length) col.u.push(col.d.pop()!);
}

export function moveS(s: SState, p: string, i: number, to: string, dry = false): boolean {
  if (p === to || to[0] !== 't') return false;
  const cards = pickedS(s, p, i);
  const dst = s.cols[Number(to.slice(1))];
  if (!cards || !dst || !fitsS(dst, cards[0])) return false;
  if (dry) return true;
  const src = s.cols[Number(p.slice(1))];
  src.u.splice(i - src.d.length);
  dst.u.push(...cards);
  settle(s, src);
  settle(s, dst);
  s.moves++;
  return true;
}

const tableCount = (s: SState) => s.cols.reduce((a, c) => a + c.d.length + c.u.length, 0);
/** A row may be dealt when no column is empty (or there aren't enough cards to fill them). */
export const canDealS = (s: SState) =>
  s.stock.length >= s.cols.length && (s.cols.every((c) => c.u.length) || tableCount(s) < s.cols.length);

export function dealRow(s: SState): boolean {
  if (!canDealS(s)) return false;
  for (const col of s.cols) col.u.push(s.stock.pop()!);
  for (const col of s.cols) settle(s, col);
  s.moves++;
  return true;
}

export const wonS = (s: SState) => s.cols.every((c) => !c.u.length && !c.d.length) && !s.stock.length;

/** Tap destination: same-suit match, any match, then an empty column. */
export function bestDestS(s: SState, p: string, i: number): string | null {
  const cards = pickedS(s, p, i);
  if (!cards) return null;
  const from = Number(p.slice(1));
  const n = s.cols.length;
  const order = Array.from({ length: n - 1 }, (_, k) => (from + 1 + k) % n);
  const c = cards[0];
  for (const t of order) {
    const col = s.cols[t];
    if (col.u.length && seqOk(col.u[col.u.length - 1], c)) return 't' + t;
  }
  for (const t of order) {
    const col = s.cols[t];
    if (col.u.length && rank(col.u[col.u.length - 1]) === rank(c) + 1) return 't' + t;
  }
  const src = s.cols[from];
  if (i === 0 && !src.d.length) return null; // whole column to an empty one
  for (const t of order) if (!s.cols[t].u.length && !s.cols[t].d.length) return 't' + t;
  return null;
}

/** Any legal (non-pointless) move or deal left? */
export function hasMoveS(s: SState): boolean {
  if (canDealS(s)) return true;
  for (let a = 0; a < s.cols.length; a++) {
    const col = s.cols[a];
    for (let k = runStartS(col.u); k < col.u.length; k++) if (bestDestS(s, 't' + a, col.d.length + k)) return true;
  }
  return false;
}
