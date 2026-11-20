import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, s, shake } from '../core/ui';
import { keyDir } from './movekit/kit';
import { adjacent, capture, cellAt, pts, stepsToward } from './pathkit/grid';
import { genTrail, wallKey } from './playkit/trail-gen';
import './trail.css';

export const trail: PuzzleDef = {
  id: 'trail',
  get name() {
    return L('Trail', 'Sentier');
  },
  category: 'paths',
  get rules() {
    return L('One path through every cell, numbers in order.', 'Un chemin par toutes les cases, numéros dans l’ordre.');
  },
  help: () => ({
    goal: L(
      'Draw a single path that visits every cell exactly once and passes the numbered checkpoints in order: it starts on 1 and ends on the highest number.',
      'Tracez un seul chemin qui passe une fois par chaque case et franchit les points numérotés dans l’ordre : il part du 1 et finit sur le plus grand numéro.',
    ),
    steps: [
      L(
        'Drag from 1 (or from the end of your path) through neighbouring cells to extend it.',
        'Glissez à partir du 1 (ou du bout de votre chemin) de case voisine en case voisine pour l’allonger.',
      ),
      L(
        'The path can’t cross itself, and a number can only be entered right after the one before it.',
        'Le chemin ne peut pas se croiser, et on n’entre sur un numéro que juste après le précédent.',
      ),
      L(
        'Thick lines between cells are walls: the path can’t go through them.',
        'Les traits épais entre les cases sont des murs : le chemin ne les traverse pas.',
      ),
      L(
        'Drag back over your path to retract it, or tap any cell of the path to cut it there.',
        'Revenez sur vos pas pour reculer, ou touchez une case du chemin pour le couper à cet endroit.',
      ),
      L(
        'Arrow keys also extend or retract the path. Clear starts over from 1.',
        'Les flèches du clavier allongent ou raccourcissent aussi le chemin. Effacer repart du 1.',
      ),
    ],
    tips: [
      L(
        'Corners and cells boxed in by walls have few ways in: plan how to reach them first.',
        'Les coins et les cases entourées de murs ont peu d’accès : prévoyez d’abord comment les atteindre.',
      ),
      L(
        'Don’t leave a pocket of cells you can’t come back out of.',
        'Ne laissez pas derrière vous un recoin d’où vous ne pourriez plus ressortir.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [30, 50, 70, 110, 170]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const P = genTrail(rng, d);
    const { n, marks, last } = P;
    const N = n * n;
    const walls = new Set(P.walls);
    const start = marks.indexOf(1);
    const end = marks.indexOf(last);
    const path: number[] = [start];

    const grid = board(n, n, 'trail-grid');
    const cells = Array.from({ length: N }, (_, i) => {
      const el = h('div', { class: 'cell', 'data-i': i });
      grid.append(el);
      return el;
    });
    const svg = s('svg', { class: 'trail-svg', viewBox: `0 0 ${n} ${n}`, 'aria-hidden': 'true' });
    for (const key of walls) {
      const a = Math.floor(key / 4096),
        b = key % 4096;
      const r = Math.floor(b / n),
        c = b % n;
      // b is right of or below a
      const seg = b - a === 1 ? { x1: c, y1: r, x2: c, y2: r + 1 } : { x1: c, y1: r, x2: c + 1, y2: r };
      svg.append(s('line', { class: 'wall', ...seg }));
    }
    const under = s('polyline', { class: 'under' });
    const over = s('polyline', { class: 'over' });
    svg.append(under, over);
    const cps: SVGGElement[] = [];
    marks.forEach((m, i) => {
      if (!m) return;
      const g = s(
        'g',
        { class: 'cp' },
        s('circle', { cx: (i % n) + 0.5, cy: Math.floor(i / n) + 0.5, r: 0.31 }),
        s('text', { x: (i % n) + 0.5, y: Math.floor(i / n) + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, m),
      );
      cps[m] = g;
      svg.append(g);
    });
    grid.append(svg);

    let finished = false;
    let drawing = false;
    const nextMark = () => {
      let mx = 0;
      for (const i of path) mx = Math.max(mx, marks[i]);
      return mx + 1;
    };
    const canEnter = (from: number, j: number) =>
      from !== end && adjacent(from, j, n) && !walls.has(wallKey(from, j)) && !path.includes(j) && (!marks[j] || marks[j] === nextMark());

    const render = () => {
      const on = new Set(path);
      const head = path[path.length - 1];
      cells.forEach((el, i) => (el.className = `cell${on.has(i) ? ' on' : ''}${i === head ? ' head' : ''}`));
      const reached = nextMark() - 1;
      cps.forEach((g, m) => g?.classList.toggle('hit', m <= reached));
      const p = pts(path, n);
      under.setAttribute('points', p);
      over.setAttribute('points', p);
      const len = path.length;
      const missed = N - len;
      ctx.status(
        head === end
          ? missed
            ? L(`${missed} cell${missed > 1 ? 's' : ''} missed`, missed > 1 ? `${missed} cases oubliées` : '1 case oubliée')
            : L('Done!', 'Terminé!')
          : L(`${len} / ${N} cells · next ${reached + 1}`, `${len} / ${N} cases · prochain ${reached + 1}`),
      );
      return head === end && !missed;
    };
    const check = () => {
      if (render() && !finished) {
        finished = true;
        drawing = false;
        ctx.solved();
      }
    };

    const dragTo = (j: number) => {
      if (!drawing || j < 0) return;
      for (let guard = 0; guard < N; guard++) {
        const head = path[path.length - 1];
        if (j === head) break;
        const at = path.indexOf(j);
        if (at >= 0) {
          path.length = at + 1;
          break;
        }
        const step = stepsToward(head, j, n).find((x) => canEnter(head, x));
        if (step == null) break;
        path.push(step);
      }
      check();
    };
    grid.addEventListener('pointerdown', (e) => {
      if (finished) return;
      const i = cellAt(grid, n, n, e.clientX, e.clientY);
      if (i < 0) return;
      const at = path.indexOf(i);
      const head = path[path.length - 1];
      if (at >= 0) path.length = at + 1;
      else if (!canEnter(head, i)) {
        if (adjacent(head, i, n)) shake(grid);
        return;
      }
      ctx.touch();
      drawing = true;
      capture(grid, e.pointerId);
      e.preventDefault();
      dragTo(i);
      check();
    });
    grid.addEventListener('pointermove', (e) => dragTo(cellAt(grid, n, n, e.clientX, e.clientY)));
    const stop = () => (drawing = false);
    grid.addEventListener('pointerup', stop);
    grid.addEventListener('pointercancel', stop);

    ctx.controls(
      btn(
        L('Clear', 'Effacer'),
        () => {
          if (finished) return;
          path.length = 1;
          render();
        },
        'ghost',
      ),
    );

    const sv = ctx.saved as { path?: unknown } | undefined;
    if (Array.isArray(sv?.path) && sv.path[0] === start) {
      const t = sv.path as number[];
      const ok = t.every((v, k) => {
        if (!Number.isInteger(v) || v < 0 || v >= N) return false;
        if (k === 0) return true;
        const good = canEnter(path[k - 1], v);
        if (good) path.push(v);
        return good;
      });
      if (!ok) path.length = 1;
    }
    root.append(grid);
    render();
    return {
      snapshot: () => ({ path }),
      onKey(e) {
        const dir = keyDir(e);
        if (dir == null || finished) return false;
        const head = path[path.length - 1];
        const r = Math.floor(head / n) + [-1, 0, 1, 0][dir],
          c = (head % n) + [0, 1, 0, -1][dir];
        if (r < 0 || r >= n || c < 0 || c >= n) return true;
        const j = r * n + c;
        ctx.touch();
        if (path.length > 1 && path[path.length - 2] === j) path.pop();
        else if (canEnter(head, j)) path.push(j);
        else shake(grid);
        check();
        return true;
      },
    };
  },
};
