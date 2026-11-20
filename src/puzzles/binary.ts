import { L, P } from '../core/i18n';
import type { Rng } from '../core/rng';
import { byLevel, type Hint, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';
import { type TakuzuRule, takuzuStep } from './logickit/takuzu-hint';

// Cell values: -1 empty, 0, 1.

/** True if placing nothing violated: no three equal in a line, no line with more than n/2 of a value. */
function okAt(g: number[], n: number, i: number): boolean {
  const r = Math.floor(i / n),
    c = i % n,
    v = g[i];
  if (v < 0) return true;
  const at = (rr: number, cc: number) => (rr >= 0 && rr < n && cc >= 0 && cc < n ? g[rr * n + cc] : -2);
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
  ]) {
    for (let k = -2; k <= 0; k++) {
      if (at(r + dr * k, c + dc * k) === v && at(r + dr * (k + 1), c + dc * (k + 1)) === v && at(r + dr * (k + 2), c + dc * (k + 2)) === v)
        return false;
    }
  }
  let rc = 0,
    cc = 0;
  for (let k = 0; k < n; k++) {
    if (g[r * n + k] === v) rc++;
    if (g[k * n + c] === v) cc++;
  }
  return rc <= n / 2 && cc <= n / 2;
}

/** Counts solutions up to `limit`; gives up (returns limit) after `budget` nodes. Fills g when rng provided. */
function solve(g: number[], n: number, limit: number, rng?: Rng, budget = 60000): number {
  let count = 0,
    nodes = 0;
  const empties = g.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
  const rec = (k: number): boolean => {
    if (++nodes > budget) {
      count = limit;
      return true;
    }
    if (k === empties.length) return ++count >= limit;
    const i = empties[k];
    const order = rng && rng.chance(0.5) ? [1, 0] : [0, 1];
    for (const v of order) {
      g[i] = v;
      if (okAt(g, n, i) && rec(k + 1)) {
        if (!rng) g[i] = -1;
        return true;
      }
    }
    g[i] = -1;
    return false;
  };
  rec(0);
  return count;
}

export const binary: PuzzleDef = {
  id: 'binary',
  get name() {
    return L('Binary', 'Binaire');
  },
  category: 'logic',
  get rules() {
    return L('No three alike in a line. Every line half and half.', 'Jamais trois pareilles de suite. Moitié-moitié par ligne.');
  },
  help: () => ({
    goal: L(
      'Fill every cell with one of two colours, following two simple rules.',
      'Remplissez chaque case avec l’une des deux couleurs, en suivant deux règles simples.',
    ),
    steps: [
      L(
        'Tap an empty cell to cycle it: dark, then colour, then empty again.',
        'Touchez une case vide pour la faire changer : foncée, puis en couleur, puis vide de nouveau.',
      ),
      L(
        'Never put three of the same colour side by side in a row or column.',
        'Jamais trois cases de la même couleur côte à côte dans une rangée ou une colonne.',
      ),
      L(
        'Every row and column holds as many of one colour as of the other.',
        'Chaque rangée et chaque colonne contient autant de cases de chaque couleur.',
      ),
      L(
        'Cells that break a rule turn red. Cells with a dot are given and can’t be changed.',
        'Les cases qui enfreignent une règle passent au rouge. Les cases avec un point sont fixes.',
      ),
    ],
    tips: [
      L(
        'Two alike side by side? The cells at both ends must be the other colour.',
        'Deux pareilles côte à côte? Les cases aux deux bouts sont de l’autre couleur.',
      ),
      L(
        'Same colour with one gap between? The middle cell is the other colour.',
        'Même couleur avec un trou entre les deux? La case du milieu est de l’autre couleur.',
      ),
      L(
        'Once a line has half of one colour, the rest is the other colour.',
        'Quand une ligne a sa moitié d’une couleur, le reste est de l’autre.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [25, 50, 80, 140, 200]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [4, 6, 6, 8, 8]);
    const maxHoles = Math.round(n * n * byLevel(d, [0.5, 0.5, 0.62, 0.6, 0.7]));

    const sol = new Array(n * n).fill(-1);
    solve(sol, n, 1, rng);
    const puz = [...sol];
    let holes = 0;
    for (const i of rng.shuffle([...puz.keys()])) {
      if (holes >= maxHoles) break;
      const keep = puz[i];
      puz[i] = -1;
      if (solve([...puz], n, 2) === 1) holes++;
      else puz[i] = keep;
    }
    const given = puz.map((v) => v >= 0);
    const g = [...puz];

    const grid = board(n);
    const cells = g.map((_, i) => {
      const el = h('button', { type: 'button', class: `cell ${given[i] ? 'given' : ''}`, onclick: () => tap(i) });
      grid.append(el);
      return el;
    });
    const render = () => {
      let ok = true;
      cells.forEach((el, i) => {
        el.classList.toggle('v0', g[i] === 0);
        el.classList.toggle('v1', g[i] === 1);
        const bad = g[i] >= 0 && !okAt(g, n, i);
        if (bad || g[i] < 0) ok = false;
        el.classList.toggle('err', bad && !given[i]);
      });
      ctx.status(P(g.filter((v) => v < 0).length, ['left', 'left'], ['à remplir', 'à remplir']));
      return ok;
    };
    const tap = (i: number) => {
      if (given[i]) return;
      ctx.touch();
      g[i] = g[i] === -1 ? 0 : g[i] === 0 ? 1 : -1;
      if (render()) ctx.solved();
    };
    const sv = ctx.saved as { g?: number[] } | undefined;
    if (sv?.g?.length === g.length) sv.g.forEach((v, i) => !given[i] && (g[i] = v));
    root.append(grid);
    render();

    const lineName = (row: boolean, k: number) =>
      row ? L(`Row ${k + 1}`, `La rangée ${k + 1}`) : L(`Column ${k + 1}`, `La colonne ${k + 1}`);
    // v0 is dark, v1 is the accent colour.
    const one = (v: number) => (v === 0 ? L('dark', 'foncée') : L('coloured', 'en couleur'));
    const many = (v: number) => (v === 0 ? L('dark', 'foncées') : L('coloured', 'en couleur'));
    const fill = (ix: number[], vs: number[]) => () =>
      ix.forEach((i, k) => {
        for (let t = 0; t < 2 && g[i] !== vs[k]; t++) tap(i);
      });
    let last: TakuzuRule | undefined;
    /** The next deduction for the guide, from the visible cells only. */
    const hint = (): Hint | null => {
      if (!g.includes(-1)) return null;
      const st = takuzuStep(g, n, last, ['pair', 'gap', 'count']);
      if (!st) {
        const i = g.indexOf(-1);
        return {
          text: L(
            `Only a ${one(sol[i])} cell fits here: the other colour would break a rule (check its row and column).`,
            `Seule une case ${one(sol[i])} convient ici : l’autre couleur briserait une règle (vérifiez sa rangée et sa colonne).`,
          ),
          at: [cells[i]],
          play: fill([i], [sol[i]]),
        };
      }
      last = st.rule;
      const name = lineName(st.row, st.line);
      const w = 1 - st.v;
      const both = st.at.length > 1;
      const text =
        st.rule === 'pair'
          ? L(
              `${name} has two ${many(st.v)} cells side by side, so ${both ? 'the cells at both ends are' : 'the next cell is'} ${one(w)}: never three alike.`,
              `${name} a deux cases ${many(st.v)} côte à côte : ${both ? 'les cases aux deux bouts sont' : 'la case suivante est'} ${both ? many(w) : one(w)}. Jamais trois pareilles!`,
            )
          : st.rule === 'gap'
            ? L(
                `Two ${many(st.v)} cells with a gap between them in ${name.toLowerCase()}: the middle one must be ${one(w)}, or it would make three in a row.`,
                `Deux cases ${many(st.v)} séparées d’un trou dans ${name.toLowerCase()} : celle du milieu doit être ${one(w)}, sinon ça ferait trois de suite.`,
              )
            : L(
                `${name} already has its ${n / 2} ${many(st.v)} cells (half of ${n}), so ${both ? 'the rest are' : 'the last one is'} ${one(w)}.`,
                `${name} a déjà ses ${n / 2} cases ${many(st.v)} (la moitié de ${n}) : ${both ? `les autres doivent être ${many(w)}` : `la dernière doit être ${one(w)}`}.`,
              );
      return { text, why: st.why.map((i) => cells[i]), at: st.at.map((i) => cells[i]), play: fill(st.at, st.vals) };
    };
    return { snapshot: () => ({ g }), hint };
  },
};
