import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';
import { fullSet, genDominosa, pairIndex } from './gridkit/dominosa';
import { capture } from './pathkit/grid';
import './dominoes.css';

export const dominoes: PuzzleDef = {
  id: 'dominoes',
  get name() {
    return L('Dominoes', 'Dominos');
  },
  category: 'logic',
  get rules() {
    return L('Split the grid into dominoes, each pair exactly once.', 'Découpez la grille en dominos, chaque paire une seule fois.');
  },
  help: () => ({
    goal: L(
      'Cut the grid of numbers into dominoes so that you use a full set: every pair of numbers exactly once.',
      'Découpez la grille de nombres en dominos pour former un jeu complet : chaque paire de nombres une seule fois.',
    ),
    steps: [
      L(
        'A domino covers two side-by-side cells. Every cell belongs to exactly one domino.',
        'Un domino couvre deux cases voisines par un côté. Chaque case appartient à un seul domino.',
      ),
      L(
        'The set holds every pair from 0-0 up to the highest double, each one once (3-5 and 5-3 are the same domino).',
        'Le jeu contient chaque paire, du 0-0 jusqu’au double le plus haut, une seule fois (3-5 et 5-3 sont le même domino).',
      ),
      L(
        'Tap the line between two cells, or drag from one cell to its neighbour, to place a domino. Do it again to remove it.',
        'Touchez la ligne entre deux cases, ou glissez d’une case à sa voisine, pour poser un domino. Refaites-le pour l’enlever.',
      ),
      L(
        'You can also tap a cell, then a neighbour. Tapping the middle of a domino removes it.',
        'Vous pouvez aussi toucher une case, puis une voisine. Touchez le milieu d’un domino pour l’enlever.',
      ),
      L(
        'The checklist below greys out the pairs you have used; pairs used twice turn red.',
        'La liste en dessous grise les paires déjà utilisées; une paire utilisée deux fois devient rouge.',
      ),
    ],
    tips: [
      L(
        'Look for pairs that can only fit in one place in the whole grid: place those first.',
        'Cherchez les paires qui ne peuvent aller qu’à un seul endroit dans toute la grille : posez-les d’abord.',
      ),
      L(
        'A cell with only one free neighbour must pair with it.',
        'Une case qui n’a qu’une seule voisine libre doit être jumelée avec elle.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [45, 80, 120, 200, 320]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [3, 4, 4, 5, 6]);
    const p = genDominosa(n, 3, d === 3 || d === 5, rng);
    const { cols, rows, val } = p;
    const N = cols * rows;
    const set = fullSet(n);

    /** Partner of each cell, -1 when free. */
    const mate = new Array<number>(N).fill(-1);
    let sel = -1;
    let done = false;

    const grid = board(cols, rows, 'do-grid');
    const cells = val.map((v, i) => {
      const el = h('div', { class: 'cell', 'data-i': i, style: `grid-area:${Math.floor(i / cols) + 1}/${(i % cols) + 1}` }, v);
      grid.append(el);
      return el;
    });
    const chips = set.map(([a, b]) => h('span', { class: 'do-chip' }, h('b', null, a), h('b', null, b)));
    const list = h('div', { class: 'do-set', 'aria-label': L('Dominoes in the set', 'Dominos du jeu') }, ...chips);
    const wrap = h('div', { class: 'do-wrap' }, grid, list);

    const render = () => {
      const used = new Array<number>(set.length).fill(0);
      for (let i = 0; i < N; i++) if (mate[i] > i) used[pairIndex(val[i], val[mate[i]], n)]++;
      // Tiles are grid items spanning their two cells, under the (transparent) number cells.
      const els: HTMLElement[] = [];
      for (let i = 0; i < N; i++) {
        const j = mate[i];
        if (j < i) continue;
        const r = Math.floor(i / cols) + 1,
          c = (i % cols) + 1;
        const horiz = j === i + 1;
        const dup = used[pairIndex(val[i], val[j], n)] > 1;
        els.push(
          h('div', {
            class: `do-tile ${horiz ? 'h' : 'v'}${dup ? ' err' : ''}${done ? ' won' : ''}`,
            style: `grid-area:${r}/${c}/span ${horiz ? 1 : 2}/span ${horiz ? 2 : 1}`,
          }),
        );
      }
      grid.replaceChildren(...els, ...cells);
      cells.forEach((el, i) => {
        el.classList.toggle('in', mate[i] >= 0);
        el.classList.toggle('sel', i === sel);
      });
      chips.forEach((el, k) => {
        el.classList.toggle('used', used[k] === 1);
        el.classList.toggle('dup', used[k] > 1);
      });
      const placed = used.reduce((t, u) => t + u, 0);
      ctx.status(L(`${placed} / ${set.length} dominoes`, `${placed} / ${set.length} dominos`));
      return placed === set.length && used.every((u) => u === 1);
    };

    const adjacent = (a: number, b: number) =>
      a >= 0 && b >= 0 && ((Math.abs(a - b) === 1 && Math.floor(a / cols) === Math.floor(b / cols)) || Math.abs(a - b) === cols);
    const unpair = (i: number) => {
      if (mate[i] >= 0) mate[mate[i]] = -1;
      mate[i] = -1;
    };
    /** Place a domino on a–b, or remove it if it is already there. */
    const toggle = (a: number, b: number) => {
      if (mate[a] === b) unpair(a);
      else {
        unpair(a);
        unpair(b);
        mate[a] = b;
        mate[b] = a;
      }
      sel = -1;
      after();
    };
    const after = () => {
      if (render() && !done) {
        done = true;
        sel = -1;
        render();
        ctx.solved();
      }
    };

    /** Where a point falls: the cell, and the neighbour across a nearby border (or -1). */
    const locate = (e: PointerEvent): { i: number; edge: number } => {
      const a = cells[0].getBoundingClientRect(),
        z = cells[N - 1].getBoundingClientRect();
      if (!(z.right > a.left) || !(e.clientX || e.clientY)) {
        const t = (e.target as Element | null)?.closest?.('[data-i]') as HTMLElement | null;
        return { i: t ? Number(t.dataset.i) : -1, edge: -1 };
      }
      const fx = ((e.clientX - a.left) / (z.right - a.left)) * cols;
      const fy = ((e.clientY - a.top) / (z.bottom - a.top)) * rows;
      const c = Math.floor(fx),
        r = Math.floor(fy);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return { i: -1, edge: -1 };
      const i = r * cols + c;
      const dx = fx - c - 0.5,
        dy = fy - r - 0.5;
      // The outer 26% of a cell on each side targets the border with that neighbour.
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.24) return { i, edge: -1 };
      let j: number;
      if (Math.abs(dx) >= Math.abs(dy)) j = dx > 0 ? (c < cols - 1 ? i + 1 : -1) : c > 0 ? i - 1 : -1;
      else j = dy > 0 ? (r < rows - 1 ? i + cols : -1) : r > 0 ? i - cols : -1;
      return { i, edge: j };
    };

    let down: { id: number; i: number; edge: number; x: number; y: number; dragged: boolean } | null = null;
    grid.addEventListener('pointerdown', (e) => {
      if (done || down || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const at = locate(e);
      if (at.i < 0) return;
      e.preventDefault();
      ctx.touch();
      capture(grid, e.pointerId);
      down = { id: e.pointerId, ...at, x: e.clientX, y: e.clientY, dragged: false };
    });
    grid.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id || down.dragged) return;
      const at = locate(e);
      if (at.i >= 0 && at.i !== down.i && adjacent(down.i, at.i) && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
        down.dragged = true;
        toggle(down.i, at.i);
      }
    });
    grid.addEventListener('pointerup', (e) => {
      const g = down;
      if (!g || e.pointerId !== g.id) return;
      down = null;
      if (g.dragged || done) return;
      if (g.edge >= 0) return toggle(g.i, g.edge);
      const i = g.i;
      if (mate[i] >= 0) {
        unpair(i);
        sel = -1;
      } else if (adjacent(sel, i)) return toggle(sel, i);
      else sel = sel === i ? -1 : i;
      after();
    });
    grid.addEventListener('pointercancel', () => (down = null));

    const sv = ctx.saved as { mate?: unknown; sel?: unknown } | undefined;
    const sm = sv?.mate;
    if (Array.isArray(sm) && sm.length === N) {
      sm.forEach((j, i) => {
        if (typeof j === 'number' && adjacent(i, j) && sm[j] === i) mate[i] = j;
      });
    }
    const s0 = sv?.sel;
    if (typeof s0 === 'number' && Number.isInteger(s0) && s0 >= 0 && s0 < N && mate[s0] < 0) sel = s0;
    root.append(wrap);
    render();
    return { snapshot: () => ({ mate, sel }) };
  },
};
