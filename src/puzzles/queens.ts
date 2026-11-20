import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';

function allSolutions(n: number): number[][] {
  const out: number[][] = [];
  const cols: number[] = [];
  const rec = (r: number) => {
    if (r === n) {
      out.push([...cols]);
      return;
    }
    for (let c = 0; c < n; c++) {
      if (cols.some((cc, rr) => cc === c || Math.abs(cc - c) === r - rr)) continue;
      cols[r] = c;
      rec(r + 1);
    }
    cols.length = r;
  };
  rec(0);
  return out;
}

export const queens: PuzzleDef = {
  id: 'queens',
  get name() {
    return L('Queens', 'Dames');
  },
  category: 'logic',
  get rules() {
    return L('One queen per row. No shared columns or diagonals.', 'Une dame par rangée, sans colonne ni diagonale commune.');
  },
  help: () => ({
    goal: L(
      'Place one queen in every row so that no two queens attack each other.',
      'Placez une dame dans chaque rangée sans que deux dames se menacent.',
    ),
    steps: [
      L(
        'Tap a square to put that row’s queen there. Tap another square in the row to move it, or the same one to remove it.',
        'Touchez une case pour y mettre la dame de la rangée. Touchez une autre case de la rangée pour la déplacer, ou la même pour l’enlever.',
      ),
      L('Two queens may not share a column or a diagonal.', 'Deux dames ne peuvent pas partager une colonne ni une diagonale.'),
      L(
        'Queens that attack each other turn red, and placing one there counts as a mistake.',
        'Les dames qui se menacent passent au rouge, et un tel placement compte comme une erreur.',
      ),
      L(
        'One queen is placed for you and can’t be moved. The board grows from 4×4 to 8×8.',
        'Une dame est déjà placée et ne peut pas bouger. La grille passe de 4×4 à 8×8.',
      ),
    ],
    tips: [
      L(
        'Start from the fixed queen: cross off its column and both diagonals.',
        'Partez de la dame fixe : éliminez sa colonne et ses deux diagonales.',
      ),
      L('Fill first the rows that have the fewest safe squares left.', 'Remplissez d’abord les rangées qui ont le moins de cases sûres.'),
    ],
  }),
  par: (d) => byLevel(d, [15, 30, 60, 100, 160]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [4, 5, 6, 7, 8]);
    const sol = rng.pick(allSolutions(n));
    // One locked queen gives every board a different starting point.
    const lockedRow = rng.int(0, n - 1);
    const q: (number | null)[] = Array.from({ length: n }, (_, r) => (r === lockedRow ? sol[r] : null));

    const grid = board(n);
    const cells = Array.from({ length: n * n }, (_, i) => {
      const r = Math.floor(i / n),
        c = i % n;
      const el = h('button', { type: 'button', class: `cell ${(r + c) % 2 ? 'alt' : ''}`, onclick: () => tap(r, c) });
      grid.append(el);
      return el;
    });

    const attacks = (r1: number, c1: number, r2: number, c2: number) => c1 === c2 || r1 === r2 || Math.abs(c1 - c2) === Math.abs(r1 - r2);
    const render = () => {
      const bad = new Set<number>();
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++) {
          if (q[a] == null || q[b] == null) continue;
          if (attacks(a, q[a]!, b, q[b]!)) {
            bad.add(a);
            bad.add(b);
          }
        }
      cells.forEach((el, i) => {
        const r = Math.floor(i / n),
          c = i % n;
        const has = q[r] === c;
        el.classList.toggle('queen', has);
        el.classList.toggle('given', has && r === lockedRow);
        el.classList.toggle('err', has && bad.has(r));
      });
      const placed = q.filter((x) => x != null).length;
      ctx.status(L(`${placed} / ${n} queens`, `${placed} / ${n} dames`));
      return bad.size === 0 && placed === n;
    };
    const tap = (r: number, c: number) => {
      if (r === lockedRow) return;
      ctx.touch();
      const before = q.some((x, rr) => x != null && rr !== r && attacks(rr, x, r, c));
      q[r] = q[r] === c ? null : c;
      if (q[r] === c && before) ctx.mistake();
      if (render()) ctx.solved();
    };
    const sv = ctx.saved as { q?: (number | null)[] } | undefined;
    if (sv?.q?.length === n) sv.q.forEach((c, r) => r !== lockedRow && (q[r] = c));
    root.append(grid);
    render();
    return { snapshot: () => ({ q }) };
  },
};
