import { genMaze } from './pathkit/maze-gen';
import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { h } from '../core/ui';

// Passage bits
const N = 1,
  E = 2,
  S = 4,
  W = 8;
const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
];

export const maze: PuzzleDef = {
  id: 'maze',
  get name() {
    return L('Maze', 'Labyrinthe');
  },
  category: 'paths',
  get rules() {
    return L('Reach the far corner. Drag, swipe or arrow keys.', 'Atteignez le coin opposé. Glissez, balayez ou flèches.');
  },
  help: () => ({
    goal: L(
      'Lead the dot from the top-left corner to the coloured square in the bottom-right corner.',
      'Menez le point du coin en haut à gauche jusqu’au carré en couleur, en bas à droite.',
    ),
    steps: [
      L('Drag your finger along the corridors: the dot follows it.', 'Glissez le doigt dans les couloirs : le point le suit.'),
      L(
        'Or swipe in a direction: the dot runs until it reaches a junction or a wall.',
        'Ou balayez dans une direction : le point avance jusqu’au prochain embranchement ou mur.',
      ),
      L(
        'Keyboard: arrow keys or W A S D move one step; hold Shift to run.',
        'Clavier : flèches ou W A S D pour un pas; maintenez Maj pour courir.',
      ),
      L(
        'Going back over your trail erases it. Mazes grow from 6×6 to 19×19.',
        'Revenir sur vos pas efface la trace. Les labyrinthes vont de 6×6 à 19×19.',
      ),
    ],
    tips: [
      L('Dead ends are cheap: just back out the way you came.', 'Un cul-de-sac ne coûte rien : revenez simplement sur vos pas.'),
      L(
        'Glance ahead from the goal back toward the start to spot the right branch.',
        'Remontez du but vers le départ du regard pour repérer le bon embranchement.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [10, 18, 30, 45, 70]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [6, 9, 12, 15, 19]);
    // Branchy growing-tree maze, best of 8 by decision points along the route (see pathkit/maze-gen.ts).
    const open = genMaze(rng, {
      size: n,
      newest: byLevel(d, [0.8, 0.75, 0.7, 0.65, 0.6]),
      braid: byLevel(d, [0, 0, 0.06, 0.1, 0.15]),
      tries: 8,
    });

    const goal = n * n - 1;
    const path = [0];
    const canvas = h('canvas', { class: 'maze' });
    const wrap = h('div', { class: 'maze-wrap' }, canvas);

    const css = (v: string) => getComputedStyle(canvas).getPropertyValue(v).trim();
    const draw = () => {
      const size = canvas.clientWidth;
      if (!size) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = canvas.height = Math.round(size * dpr);
      }
      const g = canvas.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      const pad = 3;
      const cs = (size - pad * 2) / n;
      const X = (c: number) => pad + c * cs,
        Y = (r: number) => pad + r * cs;
      g.fillStyle = css('--cell');
      g.fillRect(0, 0, size, size);
      // goal
      g.fillStyle = css('--accent');
      g.fillRect(X(n - 1), Y(n - 1), cs, cs);
      // trail
      g.strokeStyle = css('--accent');
      g.lineWidth = Math.max(2, cs * 0.28);
      g.lineCap = g.lineJoin = 'round';
      g.globalAlpha = 0.55;
      g.beginPath();
      path.forEach((i, k) => {
        const x = X(i % n) + cs / 2,
          y = Y(Math.floor(i / n)) + cs / 2;
        if (k) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.stroke();
      g.globalAlpha = 1;
      // walls
      g.strokeStyle = css('--ink');
      g.lineWidth = Math.max(1.5, cs * 0.08);
      g.lineCap = 'square';
      g.beginPath();
      for (let i = 0; i < n * n; i++) {
        const r = Math.floor(i / n),
          c = i % n,
          o = open[i];
        if (!(o & N)) {
          g.moveTo(X(c), Y(r));
          g.lineTo(X(c + 1), Y(r));
        }
        if (!(o & W)) {
          g.moveTo(X(c), Y(r));
          g.lineTo(X(c), Y(r + 1));
        }
        if (r === n - 1 && !(o & S)) {
          g.moveTo(X(c), Y(r + 1));
          g.lineTo(X(c + 1), Y(r + 1));
        }
        if (c === n - 1 && !(o & E)) {
          g.moveTo(X(c + 1), Y(r));
          g.lineTo(X(c + 1), Y(r + 1));
        }
      }
      g.stroke();
      // player
      const p = path[path.length - 1];
      g.fillStyle = css('--accent');
      g.beginPath();
      g.arc(X(p % n) + cs / 2, Y(Math.floor(p / n)) + cs / 2, cs * 0.32, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = css('--ink');
      g.lineWidth = Math.max(1.5, cs * 0.08);
      g.stroke();
    };

    let finished = false;
    const step = (dir: (typeof DIRS)[number]): boolean => {
      if (finished) return false;
      const p = path[path.length - 1];
      if (!(open[p] & dir.bit)) return false;
      const r = Math.floor(p / n) + dir.dr,
        c = (p % n) + dir.dc;
      const j = r * n + c;
      ctx.touch();
      if (path.length > 1 && path[path.length - 2] === j) path.pop();
      else path.push(j);
      if (j === goal) finished = true;
      return true;
    };
    /** Keep moving in one direction until a junction or wall. */
    const run = (dir: (typeof DIRS)[number]) => {
      if (!step(dir)) return;
      // `finished` is set inside step().
      // oxlint-disable-next-line no-unmodified-loop-condition
      for (let guard = 0; guard < n * n && !finished; guard++) {
        const p = path[path.length - 1];
        const exits = DIRS.filter((dd) => open[p] & dd.bit);
        if (exits.length !== 2 || !(open[p] & dir.bit)) break;
        step(dir);
      }
    };
    const after = () => {
      draw();
      if (finished) ctx.solved();
    };

    // Pointer: drag along the corridor (moves to adjacent open cells under the finger), or swipe.
    let dragging = false,
      sx = 0,
      sy = 0,
      moved = false;
    const cellAt = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cs = rect.width / n;
      return { r: Math.floor((e.clientY - rect.top) / cs), c: Math.floor((e.clientX - rect.left) / cs) };
    };
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const { r, c } = cellAt(e);
      // Walk toward the finger one cell at a time (handles fast drags that skip cells).
      let changed = false;
      for (let guard = 0; guard < n * 2; guard++) {
        const p = path[path.length - 1];
        const dr = r - Math.floor(p / n),
          dc = c - (p % n);
        if (!dr && !dc) break;
        const dir = Math.abs(dc) >= Math.abs(dr) ? DIRS[dc > 0 ? 1 : 3] : DIRS[dr > 0 ? 2 : 0];
        if (!step(dir)) break;
        changed = true;
      }
      if (changed) {
        moved = true;
        after();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      if (moved) return;
      const dx = e.clientX - sx,
        dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? DIRS[dx > 0 ? 1 : 3] : DIRS[dy > 0 ? 2 : 0];
      run(dir);
      after();
    });

    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', draw);
    const themeObs = new MutationObserver(draw);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // v2 = growing-tree generator; paths saved on the old mazes don't apply.
    const sv = ctx.saved as { v?: number; path?: number[] } | undefined;
    if (sv?.v === 2 && sv.path?.length && sv.path[0] === 0 && sv.path.every((v) => v >= 0 && v < n * n))
      path.splice(0, path.length, ...sv.path);
    root.append(wrap);
    requestAnimationFrame(draw);

    return {
      snapshot: () => ({ v: 2, path }),
      onKey(e) {
        const map: Record<string, number> = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
        const k = map[e.key];
        if (k == null) return false;
        if (e.shiftKey) run(DIRS[k]);
        else step(DIRS[k]);
        after();
        return true;
      },
      destroy() {
        ro.disconnect();
        themeObs.disconnect();
        mq.removeEventListener('change', draw);
      },
    };
  },
};
