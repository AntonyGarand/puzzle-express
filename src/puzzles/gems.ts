import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, pad, shake } from '../core/ui';
import { genGems, slide } from './pathkit/gems-gen';
import { capture, cellAt } from './pathkit/grid';
import './gems.css';

const KEYS: Record<string, number> = {
  ArrowUp: 0,
  w: 0,
  W: 0,
  ArrowRight: 1,
  d: 1,
  D: 1,
  ArrowDown: 2,
  s: 2,
  S: 2,
  ArrowLeft: 3,
  a: 3,
  A: 3,
};

export const gems: PuzzleDef = {
  id: 'gems',
  get name() {
    return L('Gems', 'Gemmes');
  },
  category: 'moves',
  get rules() {
    return L('Slide on ice until you hit a rock. Grab every gem.', 'Glissez jusqu’à un rocher et ramassez toutes les gemmes.');
  },
  help: () => ({
    goal: L(
      'Collect every gem. Your token slides across the ice and only stops when it hits a rock or the edge.',
      'Ramassez toutes les gemmes. Votre jeton glisse sur la glace et ne s’arrête que contre un rocher ou le bord.',
    ),
    steps: [
      L(
        'Swipe on the board, use the arrow buttons, or press the arrow keys / WASD to slide.',
        'Balayez le plateau, utilisez les flèches à l’écran ou les touches fléchées / WASD pour glisser.',
      ),
      L('You can also tap a cell to slide in its direction.', 'Vous pouvez aussi toucher une case pour glisser dans sa direction.'),
      L('Every gem you pass over on the way is collected.', 'Chaque gemme croisée en chemin est ramassée.'),
      L(
        'On Expert and Master, moves are limited (shown as 3/12). Run out and the puzzle fails.',
        'En Expert et Maître, les coups sont limités (affichés 3/12). À court de coups, c’est l’échec.',
      ),
      L('Undo takes back your last move.', 'Annuler reprend votre dernier coup.'),
    ],
    tips: [
      L(
        'Rocks are your brakes: work out which rock stops you next to each gem.',
        'Les rochers sont vos freins : repérez celui qui vous arrête près de chaque gemme.',
      ),
      L(
        'Sometimes you must move away from a gem to line up the right slide.',
        'Parfois, il faut s’éloigner d’une gemme pour bien s’aligner.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [20, 35, 60, 90, 140]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const P = genGems(rng, d);
    const { n, rock, start, limit } = P;
    const N = n * n;
    const gemIdx = new Map<number, number>();
    P.gems.forEach((g, k) => gemIdx.set(g, k));
    const G = P.gems.length;

    let hist: number[] = [];
    let at = start;
    let got = new Set<number>();
    let finished = false;

    const grid = board(n, n, 'gems-grid');
    const cells = Array.from({ length: N }, () => {
      const el = h('div', { class: 'cell' });
      grid.append(el);
      return el;
    });
    const token = h('div', { class: 'gems-token', style: `--n:${n}` });
    grid.append(token);

    const replay = () => {
      at = start;
      got = new Set();
      for (const dir of hist) {
        const s = slide(n, rock, at, dir);
        for (const x of s) if (gemIdx.has(x)) got.add(x);
        if (s.length) at = s[s.length - 1];
      }
    };
    const place = (dist: number) => {
      token.style.transitionDuration = `${Math.min(0.32, 0.06 + dist * 0.035)}s`;
      token.style.transform = `translate(${(at % n) * 100}%, ${Math.floor(at / n) * 100}%)`;
    };
    const render = () => {
      cells.forEach((el, i) => {
        el.className = `cell${rock[i] ? ' rock' : ''}${gemIdx.has(i) && !got.has(i) ? ' gem' : ''}${i === start ? ' home' : ''}`;
      });
      const mv = `${hist.length}${limit ? `/${limit}` : ''}`;
      ctx.status(L(`${got.size}/${G} gems · ${mv} moves`, `${got.size}/${G} gemmes · ${mv} coups`));
    };

    const move = (dir: number) => {
      if (finished) return;
      const s = slide(n, rock, at, dir);
      if (!s.length) {
        shake(grid);
        return;
      }
      ctx.touch();
      hist.push(dir);
      for (const x of s) if (gemIdx.has(x)) got.add(x);
      at = s[s.length - 1];
      place(s.length);
      render();
      if (got.size === G) {
        finished = true;
        ctx.solved();
      } else if (limit && hist.length >= limit) {
        finished = true;
        ctx.failed();
      }
    };

    // swipe anywhere on the board, or tap a cell to slide towards it
    let sx = 0,
      sy = 0,
      down = false;
    grid.addEventListener('pointerdown', (e) => {
      down = true;
      sx = e.clientX;
      sy = e.clientY;
      capture(grid, e.pointerId);
      e.preventDefault();
    });
    grid.addEventListener('pointerup', (e) => {
      if (!down) return;
      down = false;
      const dx = e.clientX - sx,
        dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 20) {
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
        return;
      }
      const i = cellAt(grid, n, n, e.clientX, e.clientY);
      if (i < 0 || i === at) return;
      const tr = Math.floor(i / n) - Math.floor(at / n),
        tc = (i % n) - (at % n);
      move(Math.abs(tc) > Math.abs(tr) ? (tc > 0 ? 1 : 3) : tr > 0 ? 2 : 0);
    });
    grid.addEventListener('pointercancel', () => (down = false));

    const keys = pad(
      [
        { label: '←', value: '3' },
        { label: '↑', value: '0' },
        { label: '↓', value: '2' },
        { label: '→', value: '1' },
      ],
      (v) => move(Number(v)),
    );
    ctx.controls(
      btn(
        L('Undo', 'Annuler'),
        () => {
          if (finished || !hist.length) return;
          hist.pop();
          replay();
          place(1);
          render();
        },
        'ghost',
      ),
    );

    const sv = ctx.saved as { hist?: unknown } | undefined;
    if (Array.isArray(sv?.hist) && sv.hist.every((v) => v === 0 || v === 1 || v === 2 || v === 3)) {
      hist = (sv.hist as number[]).slice(0, limit ? limit - 1 : undefined);
      replay();
      if (got.size === G) {
        hist.pop();
        replay();
      }
    }
    root.append(grid, keys);
    place(0);
    render();
    return {
      snapshot: () => ({ hist }),
      onKey(e) {
        const k = KEYS[e.key];
        if (k == null) return false;
        move(k);
        return true;
      },
    };
  },
};
