import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';
import { cellFromPointer, edgeClasses, nb4, tint } from './logickit/kit';
import { genTiles, rectCells, type Rect } from './logickit/tilesgen';
import './tiles.css';

type Placed = Rect & { k: number };

export const tiles: PuzzleDef = {
  id: 'tiles',
  get name() { return L('Tiles', 'Rectangles'); },
  category: 'logic',
  get rules() { return L('Split into rectangles, each holding one number = its area.', 'Découpez en rectangles contenant un nombre égal à leur aire.'); },
  help: () => ({
    goal: L(
      'Cut the whole grid into rectangles. Each rectangle holds exactly one number, equal to the number of cells it covers.',
      'Découpez toute la grille en rectangles. Chaque rectangle contient un seul nombre, égal au nombre de cases qu’il couvre.',
    ),
    steps: [
      L(
        'Every cell belongs to one rectangle; each rectangle has one number, and that number is its area.',
        'Chaque case appartient à un rectangle; chaque rectangle a un seul nombre, qui est son aire.',
      ),
      L(
        'Drag from one corner to the opposite corner to draw a rectangle. It replaces any rectangle it overlaps.',
        'Glissez d’un coin au coin opposé pour tracer un rectangle. Il remplace ceux qu’il chevauche.',
      ),
      L('Tap a rectangle to remove it. Tap a 1 to make a one-cell rectangle.', 'Touchez un rectangle pour l’enlever. Touchez un 1 pour faire un rectangle d’une case.'),
      L(
        'Rectangles that break the rule are marked. The footer counts the correct ones.',
        'Les rectangles fautifs sont signalés. Le bas de la carte compte les bons.',
      ),
    ],
    tips: [
      L('Start with numbers that fit only one way, like big numbers near a corner.', 'Commencez par les nombres qui n’entrent que d’une façon, comme les gros nombres près d’un coin.'),
      L('A cell only one number can reach must belong to that number’s rectangle.', 'Une case qu’un seul nombre peut atteindre fait partie de son rectangle.'),
    ],
  }),
  par: (d) => byLevel(d, [30, 60, 100, 160, 260]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [5, 6, 7, 8, 10]);
    const maxArea = byLevel(d, [6, 8, 9, 10, 12]);
    const { clue } = genTiles(n, maxArea, rng);
    const clueCount = clue.filter((v) => v > 0).length;

    let rects: Placed[] = [];
    let start = -1, cur = -1;
    let done = false;

    const grid = board(n, n, 'lk-plate');
    const cells = clue.map((v, i) => {
      const el = h('div', { class: 'cell', 'data-i': i }, v || '');
      grid.append(el);
      return el;
    });

    const span = (a: number, b: number): Rect => ({
      r0: Math.min(Math.floor(a / n), Math.floor(b / n)),
      c0: Math.min(a % n, b % n),
      r1: Math.max(Math.floor(a / n), Math.floor(b / n)),
      c1: Math.max(a % n, b % n),
    });
    const inRect = (q: Rect, i: number) => {
      const r = Math.floor(i / n), c = i % n;
      return r >= q.r0 && r <= q.r1 && c >= q.c0 && c <= q.c1;
    };
    const valid = (q: Rect) => {
      const cs = rectCells(q, n).filter((i) => clue[i] > 0);
      return cs.length === 1 && clue[cs[0]] === (q.r1 - q.r0 + 1) * (q.c1 - q.c0 + 1);
    };
    const ownerMap = () => {
      const owner = new Array<number>(n * n).fill(-1);
      rects.forEach((q, k) => rectCells(q, n).forEach((i) => (owner[i] = k)));
      return owner;
    };

    const render = () => {
      const owner = ownerMap();
      const edges = edgeClasses(n, n, (i) => owner[i]);
      const ok = rects.map(valid);
      const prev = start >= 0 && cur >= 0 ? span(start, cur) : null;
      cells.forEach((el, i) => {
        const o = owner[i];
        const cls = ['cell', edges[i]];
        if (o >= 0 && !ok[o]) cls.push('err');
        if (prev && inRect(prev, i)) cls.push('hint');
        el.className = cls.join(' ');
        el.setAttribute('style', o >= 0 ? `--rc:${tint(rects[o].k, 45)}` : '');
      });
      const good = ok.filter(Boolean).length;
      ctx.status(`${good} / ${clueCount} rectangles`);
      return owner.every((o) => o >= 0) && ok.every(Boolean);
    };

    const place = (q: Rect) => {
      rects = rects.filter((o) => o.r1 < q.r0 || o.r0 > q.r1 || o.c1 < q.c0 || o.c0 > q.c1);
      const owner = ownerMap();
      const near = new Set<number>();
      for (const i of rectCells(q, n)) for (const j of nb4(i, n, n)) if (owner[j] >= 0 && !inRect(q, j)) near.add(rects[owner[j]].k);
      const off = (rects.length * 3 + q.r0 + q.c0) % 8;
      let k = 0;
      while (k < 8 && near.has((k + off) % 8)) k++;
      rects.push({ ...q, k: (k + off) % 8 });
    };

    const finish = () => {
      if (start < 0) return;
      const a = start, b = cur;
      start = cur = -1;
      if (b >= 0) {
        if (a === b) {
          const owner = ownerMap();
          if (owner[a] >= 0) rects.splice(owner[a], 1);
          else if (clue[a] === 1) place(span(a, a));
        } else place(span(a, b));
      }
      if (render() && !done) { done = true; ctx.solved(); }
    };

    grid.addEventListener('pointerdown', (e) => {
      if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const i = cellFromPointer(grid, e, n, n);
      if (i < 0) return;
      ctx.touch();
      e.preventDefault();
      try { grid.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      start = cur = i;
      render();
    });
    grid.addEventListener('pointermove', (e) => {
      if (start < 0) return;
      const i = cellFromPointer(grid, e, n, n);
      if (i >= 0 && i !== cur) { cur = i; render(); }
    });
    grid.addEventListener('pointerup', (e) => {
      if (start < 0) return;
      const i = cellFromPointer(grid, e, n, n);
      if (i >= 0) cur = i;
      finish();
    });
    grid.addEventListener('pointercancel', () => { start = cur = -1; render(); });
    grid.addEventListener('contextmenu', (e) => e.preventDefault());

    const sv = ctx.saved as { rects?: unknown } | undefined;
    if (Array.isArray(sv?.rects)) {
      for (const q of sv.rects as Placed[]) {
        const okNum = [q?.r0, q?.c0, q?.r1, q?.c1, q?.k].every((x) => Number.isInteger(x) && x >= 0);
        if (okNum && q.r1 < n && q.c1 < n && q.r0 <= q.r1 && q.c0 <= q.c1) rects.push({ r0: q.r0, c0: q.c0, r1: q.r1, c1: q.c1, k: q.k % 8 });
      }
    }
    root.append(grid);
    render();
    return { snapshot: () => ({ rects }) };
  },
};
