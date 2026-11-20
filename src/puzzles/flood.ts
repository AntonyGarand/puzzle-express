import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, PALETTE } from '../core/ui';

/** Flood from the top-left corner with colour `c`; returns the new grid. */
function flood(g: number[], n: number, c: number): number[] {
  const out = [...g];
  const from = g[0];
  if (from === c) return out;
  const stack = [0];
  const seen = new Set([0]);
  while (stack.length) {
    const i = stack.pop()!;
    out[i] = c;
    const r = Math.floor(i / n), col = i % n;
    for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, col > 0 ? i - 1 : -1, col < n - 1 ? i + 1 : -1]) {
      if (j >= 0 && !seen.has(j) && g[j] === from) { seen.add(j); stack.push(j); }
    }
  }
  return out;
}
function regionSize(g: number[], n: number): number {
  const c = g[0];
  const stack = [0];
  const seen = new Set([0]);
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n), col = i % n;
    for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, col > 0 ? i - 1 : -1, col < n - 1 ? i + 1 : -1]) {
      if (j >= 0 && !seen.has(j) && g[j] === c) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size;
}

export const floodPuzzle: PuzzleDef = {
  id: 'flood',
  get name() { return L('Flood', 'Inondation'); },
  category: 'moves',
  get rules() { return L('Flood the whole board with one colour.', 'Couvrez toute la grille d’une seule couleur.'); },
  help: () => ({
    goal: L(
      'Turn the whole board into a single colour before you run out of moves.',
      'Couvrez toute la grille d’une seule couleur avant d’épuiser vos coups.',
    ),
    steps: [
      L('Your area starts in the top-left corner.', 'Votre zone part du coin en haut à gauche.'),
      L('Pick a colour from the palette (or tap a tile of that colour, or press 1, 2, 3…). Your area takes that colour and swallows the touching tiles of the same colour.', 'Choisissez une couleur dans la palette (ou touchez une case de cette couleur, ou appuyez sur 1, 2, 3…). Votre zone prend cette couleur et absorbe les cases voisines de la même couleur.'),
      L('The status line shows moves used out of the limit.', 'La ligne d’état affiche les coups joués sur le maximum permis.'),
      L('Cover the board within the limit to win. Reach the limit first and the game is lost.', 'Couvrez la grille dans la limite pour gagner. Si vous l’atteignez avant, la partie est perdue.'),
    ],
    tips: [
      L('Pick the colour that grabs the most tiles, but think one move ahead.', 'Choisissez la couleur qui gagne le plus de cases, mais pensez un coup d’avance.'),
      L('Push toward the middle and far corner early: a longer border gives bigger captures.', 'Avancez tôt vers le centre et le coin opposé : une frontière plus longue donne de plus grosses prises.'),
    ],
  }),
  par: (d) => byLevel(d, [20, 30, 45, 60, 80]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [6, 8, 10, 12, 14]);
    const k = byLevel(d, [3, 4, 5, 6, 6]);
    const slack = byLevel(d, [5, 4, 3, 2, 1]);
    let g = Array.from({ length: n * n }, () => rng.int(0, k - 1));

    // Greedy solve (with a one-move lookahead) to set a fair move limit.
    let sim = g, greedy = 0;
    while (regionSize(sim, n) < n * n && greedy < 200) {
      let best = sim, bestS = -1;
      for (let c = 0; c < k; c++) {
        if (c === sim[0]) continue;
        const a = flood(sim, n, c);
        let s = regionSize(a, n) * 4;
        for (let c2 = 0; c2 < k; c2++) if (c2 !== c) s = Math.max(s, regionSize(a, n) * 3 + regionSize(flood(a, n, c2), n));
        if (s > bestS) { bestS = s; best = a; }
      }
      sim = best;
      greedy++;
    }
    const limit = greedy + slack;
    let moves = 0;

    const grid = board(n, n, 'flood');
    const cells = g.map((_, i) => {
      const el = h('div', { class: 'cell', onclick: () => choose(g[i]) });
      grid.append(el);
      return el;
    });
    const palette = h('div', { class: 'pad' });
    for (let c = 0; c < k; c++) palette.append(h('button', { type: 'button', class: 'key swatch', style: `--c:${PALETTE[c]}`, 'aria-label': L(`colour ${c + 1}`, `couleur ${c + 1}`), onclick: () => choose(c) }));

    const render = () => {
      cells.forEach((el, i) => (el.style.background = PALETTE[g[i]]));
      ctx.status(L(`${moves} / ${limit} moves`, `${moves} / ${limit} coups`));
    };
    const choose = (c: number) => {
      if (c === g[0]) return;
      ctx.touch();
      g = flood(g, n, c);
      moves++;
      render();
      if (regionSize(g, n) === n * n) ctx.solved();
      else if (moves >= limit) ctx.failed();
    };
    const sv = ctx.saved as { g?: number[]; moves?: number } | undefined;
    if (sv?.g?.length === g.length) {
      g = sv.g;
      moves = sv.moves ?? 0;
    }
    root.append(grid, palette);
    render();
    return {
      snapshot: () => ({ g, moves }),
      onKey(e) {
        const v = Number(e.key);
        if (v >= 1 && v <= k) { choose(v - 1); return true; }
        return false;
      },
    };
  },
};
