import './unequal.css';
import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { h, s } from '../core/ui';
import { entryGame, entryHelpSteps } from './sudokukit/entry';
import { isUnique, lineUnits, revealUntilUnique, solve, type Problem } from './sudokukit/solver';

export const unequal: PuzzleDef = {
  id: 'unequal',
  get name() {
    return L('Unequal', 'Inégalités');
  },
  category: 'logic',
  get rules() {
    return L('Each number once per row and column; obey the signs.', 'Chiffres uniques par rangée et colonne; suivez les signes.');
  },
  help: () => ({
    goal: L(
      'Fill the grid so each number appears once in every row and column, and every sign between two cells is true.',
      'Remplissez la grille pour que chaque chiffre apparaisse une fois par rangée et par colonne, en respectant tous les signes.',
    ),
    steps: [
      L(
        'Use the numbers 1 up to the grid size (1 to 4 on a 4×4 grid).',
        'Utilisez les chiffres de 1 jusqu’à la taille de la grille (1 à 4 sur une grille 4 × 4).',
      ),
      L(
        'A chevron between two cells points at the smaller number, like < and >.',
        'Un chevron entre deux cases pointe vers le plus petit chiffre, comme < et >.',
      ),
      ...entryHelpSteps(),
    ],
    tips: [
      L(
        'A cell bigger than a neighbour can’t be 1; a cell smaller than one can’t be the largest number.',
        'Une case plus grande qu’une voisine ne peut pas valoir 1; une case plus petite ne peut pas valoir le maximum.',
      ),
      L(
        'Follow chains of signs: three cells in a row that keep rising leave very few options at each end.',
        'Suivez les chaînes de signes : trois cases qui montent de suite laissent peu de choix aux extrémités.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [35, 70, 110, 200, 330]),
  create(ctx) {
    const { rng, difficulty: d } = ctx;
    const n = byLevel(d, [4, 5, 5, 6, 7]);
    const keepFrac = byLevel(d, [0.4, 0.3, 0.15, 0.1, 0]); // share of all possible signs kept at least
    const extraGivens = byLevel(d, [1, 1, 0, 0, 0]);
    const units = lineUnits(n);
    const sol = new Array(n * n).fill(0);
    solve({ size: n * n, maxDigit: n, units }, sol, 1, 100000, rng);

    const pairs: [number, number][] = [];
    for (let i = 0; i < n * n; i++) {
      for (const j of [i % n < n - 1 ? i + 1 : -1, i + n < n * n ? i + n : -1]) {
        if (j >= 0) pairs.push(sol[i] < sol[j] ? [i, j] : [j, i]);
      }
    }
    const on = pairs.map(() => true);
    const prob = (): Problem => ({ size: n * n, maxDigit: n, units, lt: pairs.filter((_, k) => on[k]) });
    const puzzle = new Array(n * n).fill(0);
    revealUntilUnique(prob(), puzzle, sol, 20000, rng);

    // Strip clues (signs and any givens) while the solution stays unique.
    const minSigns = Math.round(pairs.length * keepFrac);
    type Item = { sign: number } | { cell: number };
    const items: Item[] = rng.shuffle([...pairs.map((_, k) => ({ sign: k })), ...puzzle.flatMap((v, i) => (v ? [{ cell: i }] : []))]);
    let signs = pairs.length;
    for (const it of items) {
      if ('sign' in it) {
        if (signs <= minSigns) continue;
        on[it.sign] = false;
        if (isUnique(prob(), puzzle, 20000)) signs--;
        else on[it.sign] = true;
      } else {
        const v = puzzle[it.cell];
        puzzle[it.cell] = 0;
        if (!isUnique(prob(), puzzle, 20000)) puzzle[it.cell] = v;
      }
    }
    for (let k = 0; k < extraGivens; k++) {
      const c = rng.pick([...puzzle.keys()].filter((i) => !puzzle[i]));
      puzzle[c] = sol[c];
    }

    const signsAt: [string, string, string][][] = Array.from({ length: n * n }, () => []);
    pairs.forEach(([a, b], k) => {
      if (!on[k]) return;
      const p = Math.min(a, b),
        q = Math.max(a, b);
      const across = q === p + 1;
      const pSmaller = a === p;
      // chevron points towards the smaller cell
      const pts = across ? (pSmaller ? '66,14 30,50 66,86' : '34,14 70,50 34,86') : pSmaller ? '14,66 50,30 86,66' : '14,34 50,70 86,34';
      signsAt[p].push([across ? 'r' : 'd', pts, across ? (pSmaller ? '<' : '>') : pSmaller ? '^' : 'v']);
    });
    return entryGame({
      ctx,
      cols: n,
      rows: n,
      problem: prob(),
      puzzle,
      boardClass: 'unequal',
      decorate(el, i) {
        for (const [dir, pts, label] of signsAt[i]) {
          el.append(
            h('span', { class: `sg ${dir}`, 'data-sign': label }, s('svg', { viewBox: '0 0 100 100' }, s('polyline', { points: pts }))),
          );
        }
      },
    });
  },
};
