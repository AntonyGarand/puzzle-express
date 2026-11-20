import './skyscrapers.css';
import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';
import { latinEntry, latinEntrySteps } from './latinkit/entry';
import { latinConflicts, latinUnique, randomLatin, revealLatin, type Table } from './latinkit/solver';

/** Buildings seen from the start of `line` (taller ones hide shorter ones behind them). */
const visible = (line: ArrayLike<number>) => {
  let max = 0,
    k = 0;
  for (let i = 0; i < line.length; i++)
    if (line[i] > max) {
      max = line[i];
      k++;
    }
  return k;
};

interface Perms {
  flat: Uint8Array;
  fwd: Uint8Array;
  back: Uint8Array;
}
const PERMS = new Map<number, Perms>();
/** Every permutation of 1..n with its visibility from both ends (cached per n). */
function perms(n: number): Perms {
  const hit = PERMS.get(n);
  if (hit) return hit;
  const out: number[][] = [];
  const cur: number[] = [];
  const used = new Array(n + 1).fill(false);
  const rec = () => {
    if (cur.length === n) return void out.push([...cur]);
    for (let v = 1; v <= n; v++) {
      if (used[v]) continue;
      used[v] = true;
      cur.push(v);
      rec();
      cur.pop();
      used[v] = false;
    }
  };
  rec();
  const p: Perms = {
    flat: Uint8Array.from(out.flat()),
    fwd: Uint8Array.from(out, (q) => visible(q)),
    back: Uint8Array.from(out, (q) => visible([...q].reverse())),
  };
  PERMS.set(n, p);
  return p;
}

export const skyscrapers: PuzzleDef = {
  id: 'skyscrapers',
  get name() {
    return L('Skyscrapers', 'Gratte-ciel');
  },
  category: 'logic',
  get rules() {
    return L('Heights once per line; edge clues count what you see.', 'Hauteurs uniques par ligne; les indices comptent les vues.');
  },
  help: () => ({
    goal: L(
      'Place a building in every cell so each row and column has every height once, and the clues around the edge are right.',
      'Placez un immeuble dans chaque case pour que chaque rangée et colonne ait chaque hauteur une fois, en respectant les indices du pourtour.',
    ),
    steps: [
      L(
        'Heights go from 1 to the grid size (1 to 4 on a 4×4 grid), once per row and once per column.',
        'Les hauteurs vont de 1 à la taille de la grille (1 à 4 en 4 × 4), une fois par rangée et par colonne.',
      ),
      L(
        'A clue tells how many buildings you see looking into its line from that side: taller buildings hide shorter ones behind them.',
        'Un indice donne combien d’immeubles on voit en regardant sa ligne de ce côté : les plus hauts cachent les plus bas derrière eux.',
      ),
      ...latinEntrySteps(),
      L(
        'Once a line is full, its clues turn pale when they’re right and red when they’re wrong.',
        'Quand une ligne est pleine, ses indices pâlissent s’ils sont respectés et passent au rouge sinon.',
      ),
    ],
    tips: [
      L(
        'A 1 means the tallest building stands right next to that clue.',
        'Un 1 veut dire que le plus haut immeuble est juste à côté de cet indice.',
      ),
      L(
        'A clue equal to the grid size means the heights climb 1, 2, 3… from that side.',
        'Un indice égal à la taille de la grille veut dire que les hauteurs montent 1, 2, 3… de ce côté.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [45, 90, 170, 260, 420]),
  create(ctx) {
    const { rng, difficulty: d } = ctx;
    const n = byLevel(d, [4, 5, 6, 6, 7]);
    const minClues = Math.round(4 * n * byLevel(d, [0.7, 0.55, 0.45, 0.3, 0]));
    const extraGivens = byLevel(d, [2, 1, 1, 0, 0]);
    const budget = byLevel(d, [3000, 3000, 3000, 4000, 6000]);
    const P = perms(n);
    const sol = randomLatin(n, rng);

    // clue k: side = k / n (0 top, 1 right, 2 bottom, 3 left), position = k % n
    const lineOf = (side: number, pos: number) =>
      Array.from({ length: n }, (_, t) =>
        side === 0 ? t * n + pos : side === 1 ? pos * n + (n - 1 - t) : side === 2 ? (n - 1 - t) * n + pos : pos * n + t,
      );
    const clueLines = Array.from({ length: 4 * n }, (_, k) => lineOf(Math.floor(k / n), k % n));
    const clue = clueLines.map((cells) => visible(cells.map((c) => sol[c])));
    const on = clue.map(() => true);

    const tables = (): Table[] => {
      const out: Table[] = [];
      for (let lane = 0; lane < 2 * n; lane++) {
        // lanes: rows (left → right) then columns (top → bottom)
        const row = lane < n,
          p = lane % n;
        const a = row ? 3 * n + p : p; // clue at the start (left / top)
        const b = row ? n + p : 2 * n + p; // clue at the end (right / bottom)
        if (!on[a] && !on[b]) continue;
        const cells = Array.from({ length: n }, (_, t) => (row ? p * n + t : t * n + p));
        const keep: number[] = [];
        for (let q = 0; q < P.fwd.length; q++) if ((!on[a] || P.fwd[q] === clue[a]) && (!on[b] || P.back[q] === clue[b])) keep.push(q);
        const tuples = new Uint8Array(keep.length * n);
        keep.forEach((q, j) => tuples.set(P.flat.subarray(q * n, q * n + n), j * n));
        out.push({ cells, tuples });
      }
      return out;
    };

    const givens = new Array(n * n).fill(0);
    revealLatin(n, givens, tables(), sol, budget, rng);
    let clues = 4 * n;
    type Item = { clue: number } | { cell: number };
    const items: Item[] = rng.shuffle([...clue.map((_, k) => ({ clue: k })), ...givens.flatMap((v, i) => (v ? [{ cell: i }] : []))]);
    for (const it of items) {
      if ('clue' in it) {
        if (clues <= minClues) continue;
        on[it.clue] = false;
        if (latinUnique(n, givens, tables(), budget)) clues--;
        else on[it.clue] = true;
      } else {
        givens[it.cell] = 0;
        if (!latinUnique(n, givens, tables(), budget)) givens[it.cell] = sol[it.cell];
      }
    }
    for (let k = 0; k < extraGivens; k++) {
      const open = [...givens.keys()].filter((i) => !givens[i]);
      if (open.length <= 2) break;
      const c = rng.pick(open);
      givens[c] = sol[c];
    }

    const clueEls = clue.map((v, k) => h('div', { class: 'sky-clue', 'data-k': k }, on[k] ? v : ''));
    const lineState = (vals: number[], k: number) => {
      const vs = clueLines[k].map((c) => vals[c]);
      if (vs.some((v) => !v)) return 0;
      return visible(vs) === clue[k] ? 1 : -1;
    };
    return latinEntry({
      ctx,
      n,
      givens,
      boardClass: 'lk-num sky',
      layout(cells) {
        const grid = board(n + 2, n + 2, 'lk-num sky');
        const corner = () => h('div', { class: 'sky-corner' });
        grid.append(corner(), ...clueEls.slice(0, n), corner());
        for (let r = 0; r < n; r++) grid.append(clueEls[3 * n + r], ...cells.slice(r * n, r * n + n), clueEls[n + r]);
        grid.append(corner(), ...clueEls.slice(2 * n, 3 * n), corner());
        return grid;
      },
      check: (vals) => latinConflicts(n, vals),
      valid: (vals) => clue.every((_, k) => !on[k] || lineState(vals, k) === 1),
      after(vals) {
        clueEls.forEach((el, k) => {
          const st = on[k] ? lineState(vals, k) : 0;
          el.classList.toggle('ok', st === 1);
          el.classList.toggle('bad', st === -1);
        });
      },
    });
  },
};
