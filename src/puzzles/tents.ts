import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, s } from '../core/ui';
import { nb4, nb8 } from './logickit/kit';
import { genTents, tentsMatch } from './logickit/tentsgen';
import './tents.css';

const treeSvg = () =>
  s('svg', { viewBox: '0 0 100 100', class: 'lk-tree', 'aria-hidden': 'true' },
    s('rect', { x: 43, y: 56, width: 14, height: 32, rx: 3, class: 'trunk' }),
    s('circle', { cx: 50, cy: 40, r: 27, class: 'crown' }),
  );
const tentSvg = () =>
  s('svg', { viewBox: '0 0 100 100', class: 'lk-tent', 'aria-hidden': 'true' },
    s('polygon', { points: '50,14 90,84 10,84', class: 'canvas' }),
    s('polygon', { points: '50,46 63,84 37,84', class: 'door' }),
  );

export const tents: PuzzleDef = {
  id: 'tents',
  get name() { return L('Tents', 'Tentes'); },
  category: 'logic',
  get rules() { return L('A tent beside each tree. Tents never touch. Match counts.', 'Une tente près de chaque arbre, sans contact. Totaux exacts.'); },
  help: () => ({
    goal: L(
      'Pitch one tent next to each tree, so the numbers on the edges match the tents in every row and column.',
      'Plantez une tente à côté de chaque arbre, de sorte que les nombres en bordure correspondent aux tentes de chaque rangée et colonne.',
    ),
    steps: [
      L(
        'Each tree gets its own tent, directly above, below, left or right of it (not diagonally).',
        'Chaque arbre a sa propre tente, juste au-dessus, en dessous, à gauche ou à droite (pas en diagonale).',
      ),
      L('Tents never touch each other, not even at a corner.', 'Les tentes ne se touchent jamais, même pas en diagonale.'),
      L(
        'The numbers on top and on the left say how many tents go in that column or row.',
        'Les nombres en haut et à gauche indiquent combien de tentes vont dans cette colonne ou cette rangée.',
      ),
      L(
        'Tap a cell once for grass (no tent), twice for a tent, a third time to clear it.',
        'Touchez une case une fois pour du gazon (pas de tente), deux fois pour une tente, trois fois pour l’effacer.',
      ),
    ],
    tips: [
      L('A row or column marked 0 is all grass.', 'Une rangée ou une colonne marquée 0 est entièrement en gazon.'),
      L(
        'Cells that don’t touch any tree side-on can never hold a tent: fill them with grass first.',
        'Les cases qui ne touchent aucun arbre par un côté ne peuvent pas avoir de tente : mettez-y du gazon d’abord.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [40, 70, 120, 180, 300]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [5, 6, 7, 8, 10]);
    const density = byLevel(d, [0.16, 0.17, 0.18, 0.19, 0.2]);
    const p = genTents(n, density, rng);
    const isTree = new Array<boolean>(n * n).fill(false);
    p.trees.forEach((t) => (isTree[t] = true));

    // 0 empty, 1 grass, 2 tent
    const st = new Array<number>(n * n).fill(0);
    const grid = board(n + 1, n + 1, 'lk-tents');
    const colEls = p.cols.map((v) => h('div', { class: 'lk-clue' }, v));
    const rowEls = p.rows.map((v) => h('div', { class: 'lk-clue' }, v));
    grid.append(h('div', { class: 'lk-clue corner' }), ...colEls);
    const cells: HTMLElement[] = [];
    for (let r = 0; r < n; r++) {
      grid.append(rowEls[r]);
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const el = isTree[i]
          ? h('div', { class: 'cell given tree', 'data-i': i }, treeSvg())
          : h('button', { type: 'button', class: 'cell', 'data-i': i, onclick: () => tap(i) }, tentSvg());
        cells.push(el);
        grid.append(el);
      }
    }

    const render = () => {
      const placed = st.map((v, i) => (v === 2 ? i : -1)).filter((i) => i >= 0);
      const rows = new Array<number>(n).fill(0), cols = new Array<number>(n).fill(0);
      for (const t of placed) { rows[Math.floor(t / n)]++; cols[t % n]++; }
      cells.forEach((el, i) => {
        if (isTree[i]) return;
        const tent = st[i] === 2;
        const bad = tent && (nb8(i, n, n).some((j) => st[j] === 2) || !nb4(i, n, n).some((j) => isTree[j]));
        el.classList.toggle('tent', tent);
        el.classList.toggle('grass', st[i] === 1);
        el.classList.toggle('err', bad);
      });
      let ok = true;
      const clue = (el: HTMLElement, have: number, want: number) => {
        el.classList.toggle('done', have === want);
        el.classList.toggle('over', have > want);
        ok &&= have === want;
      };
      colEls.forEach((el, c) => clue(el, cols[c], p.cols[c]));
      rowEls.forEach((el, r) => clue(el, rows[r], p.rows[r]));
      ctx.status(L(`${placed.length} / ${p.trees.length} tents`, `${placed.length} / ${p.trees.length} tentes`));
      return ok && !placed.some((t) => nb8(t, n, n).some((j) => st[j] === 2)) && tentsMatch(n, p.trees, placed);
    };

    let done = false;
    const tap = (i: number) => {
      if (done) return;
      ctx.touch();
      st[i] = (st[i] + 1) % 3;
      if (render()) { done = true; ctx.solved(); }
    };

    const sv = ctx.saved as { st?: unknown } | undefined;
    if (Array.isArray(sv?.st) && sv.st.length === st.length) sv.st.forEach((v, i) => (st[i] = !isTree[i] && (v === 1 || v === 2) ? v : 0));
    root.append(grid);
    render();
    return { snapshot: () => ({ st }) };
  },
};
