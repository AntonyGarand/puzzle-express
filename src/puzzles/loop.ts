import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { h, s } from '../core/ui';
import { capture } from './pathkit/grid';
import { genLoop, isSingleLoop } from './gridkit/slither';
import './loop.css';

const PAD = 0.38; // board margin around the dots, in cell units

export const loop: PuzzleDef = {
  id: 'loop',
  get name() {
    return L('Loop', 'Boucle');
  },
  category: 'paths',
  get rules() {
    return L('Draw one loop. Numbers count the sides it uses.', 'Tracez une boucle. Les nombres comptent ses côtés utilisés.');
  },
  help: () => ({
    goal: L(
      'Draw a single closed loop along the lines between the dots, so that every number is right.',
      'Tracez une seule boucle fermée en reliant les points, de sorte que chaque nombre soit juste.',
    ),
    steps: [
      L(
        'A number tells how many of the 4 sides of its cell the loop uses. Cells without a number can have any count.',
        'Un nombre indique combien des 4 côtés de sa case la boucle utilise. Les cases sans nombre peuvent en avoir n’importe combien.',
      ),
      L(
        'The loop never crosses or touches itself and never branches: each dot has 0 or 2 lines.',
        'La boucle ne se croise pas, ne se touche pas et ne se divise pas : chaque point a 0 ou 2 lignes.',
      ),
      L(
        'Tap a side to draw a line, again for a ✕ (surely no line), and once more to clear it.',
        'Touchez un côté pour tracer une ligne, encore pour un ✕ (aucune ligne), puis une autre fois pour l’effacer.',
      ),
      L(
        'Drag from dot to dot to draw several lines at once; start a drag on a line to erase instead.',
        'Glissez de point en point pour tracer plusieurs lignes d’un coup; commencez sur une ligne pour effacer plutôt.',
      ),
      L(
        'Numbers fade once they have exactly enough lines (a 0 once its sides are ✕) and turn red with too many.',
        'Les nombres pâlissent quand ils ont juste assez de lignes (un 0, quand ses côtés sont en ✕) et rougissent s’ils en ont trop.',
      ),
    ],
    tips: [
      L(
        'A 0 has no lines around it: put ✕ on its four sides. Two 3s side by side share a line between them.',
        'Un 0 n’a aucune ligne autour : mettez des ✕ sur ses quatre côtés. Deux 3 côte à côte partagent la ligne qui les sépare.',
      ),
      L(
        'A dot with one line must continue: if only one way is open, the line goes there.',
        'Un point avec une seule ligne doit continuer : si un seul chemin est libre, la ligne passe par là.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [45, 80, 140, 220, 360]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [5, 6, 7, 8, 10]);
    const { g, clue } = genLoop(n, n, byLevel(d, [0.6, 0.45, 0.3, 0.15, 0]), rng);
    const { E, ea, eb, ve, ce } = g;
    const W = n + 1; // vertices per row
    const vx = (v: number) => v % W,
      vy = (v: number) => Math.floor(v / W);

    // 0 empty, 1 line, 2 ✕
    const st = new Array<number>(E).fill(0);
    let done = false;

    const size = n + 2 * PAD;
    const svg = s('svg', { viewBox: `${-PAD} ${-PAD} ${size} ${size}`, class: 'lo-svg' });
    const gEdges = s('g');
    const gDots = s('g');
    const gNums = s('g');
    svg.append(gNums, gEdges, gDots);
    const edgeEls = Array.from({ length: E }, (_, e) => {
      const x1 = vx(ea[e]),
        y1 = vy(ea[e]),
        x2 = vx(eb[e]),
        y2 = vy(eb[e]);
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2,
        k = 0.09;
      const el = s(
        'g',
        { class: 'edge', 'data-e': e },
        s('line', { x1, y1, x2, y2, class: 'ln' }),
        s('path', { d: `M${mx - k} ${my - k}L${mx + k} ${my + k}M${mx + k} ${my - k}L${mx - k} ${my + k}`, class: 'xx' }),
      );
      gEdges.append(el);
      return el;
    });
    const dotEls = ve.map((_, v) => {
      const el = s('circle', { cx: vx(v), cy: vy(v), r: 0.075, class: 'vx' });
      gDots.append(el);
      return el;
    });
    const numEls = clue.map((k, c) => {
      if (k < 0) return null;
      const el = s(
        'text',
        { x: (c % n) + 0.5, y: Math.floor(c / n) + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'lo-n' },
        k,
      );
      gNums.append(el);
      return el;
    });
    const wrap = h('div', { class: 'lo-board' }, svg);

    const render = () => {
      edgeEls.forEach((el, e) => el.setAttribute('class', `edge${st[e] === 1 ? ' on' : st[e] === 2 ? ' x' : ''}`));
      dotEls.forEach((el, v) => {
        const deg = ve[v].filter((e) => st[e] === 1).length;
        el.setAttribute('class', `vx${deg > 2 ? ' err' : deg ? ' on' : ''}`);
      });
      let good = 0,
        total = 0,
        ok = true;
      numEls.forEach((el, c) => {
        if (!el) return;
        total++;
        const k = ce[c].filter((e) => st[e] === 1).length;
        if (k === clue[c]) good++;
        else ok = false;
        // A 0 only fades once its four sides are crossed out, so it stays visible as a hint.
        const settled = clue[c] > 0 || ce[c].every((e) => st[e] === 2);
        el.setAttribute('class', `lo-n${k === clue[c] && settled ? ' done' : k > clue[c] ? ' err' : ''}`);
      });
      ctx.status(`${good} / ${P(total, ['number', 'numbers'], ['nombre', 'nombres'])}`);
      return ok && isSingleLoop(g, (e) => st[e] === 1);
    };

    const after = () => {
      if (!done && render()) {
        done = true;
        wrap.classList.add('won');
        ctx.solved();
      }
    };

    // Geometry: pointer position in board units, nearest edge, nearest dot.
    const toUnits = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      if (!(rect.width > 0) || !(e.clientX || e.clientY)) return null;
      return { x: -PAD + ((e.clientX - rect.left) / rect.width) * size, y: -PAD + ((e.clientY - rect.top) / rect.height) * size };
    };
    const H = (n + 1) * n;
    const edgeAt = (x: number, y: number) => {
      const cl = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
      const hr = cl(Math.round(y), n),
        hc = cl(Math.floor(x), n - 1);
      const hd = Math.abs(y - hr) + Math.max(0, -x, x - n);
      const vc = cl(Math.round(x), n),
        vr = cl(Math.floor(y), n - 1);
      const vd = Math.abs(x - vc) + Math.max(0, -y, y - n);
      return hd <= vd ? hr * n + hc : H + vr * (n + 1) + vc;
    };
    const dotAt = (x: number, y: number, within: number) => {
      const c = Math.round(x),
        r = Math.round(y);
      if (c < 0 || r < 0 || c > n || r > n || Math.hypot(x - c, y - r) > within) return -1;
      return r * W + c;
    };
    const edgeBetween = (a: number, b: number) => ve[a].find((e) => ea[e] === b || eb[e] === b) ?? -1;

    let drag: { id: number; x: number; y: number; edge: number; anchor: number; mode: number; drew: boolean } | null = null;
    svg.addEventListener('pointerdown', (e) => {
      if (done || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const pt = toUnits(e);
      let edge = -1;
      if (pt) edge = edgeAt(pt.x, pt.y);
      else {
        const t = (e.target as Element | null)?.closest?.('[data-e]');
        edge = t ? Number(t.getAttribute('data-e')) : -1;
      }
      if (edge < 0) return;
      e.preventDefault();
      ctx.touch();
      capture(svg, e.pointerId);
      drag = { id: e.pointerId, x: pt?.x ?? 0, y: pt?.y ?? 0, edge, anchor: pt ? dotAt(pt.x, pt.y, 0.36) : -1, mode: -1, drew: false };
    });
    svg.addEventListener('pointermove', (e) => {
      const g0 = drag;
      if (!g0 || e.pointerId !== g0.id || done) return;
      const pt = toUnits(e);
      if (!pt) return;
      const v = dotAt(pt.x, pt.y, 0.3);
      if (v < 0 || v === g0.anchor) return;
      const k = g0.anchor >= 0 ? edgeBetween(g0.anchor, v) : -1;
      g0.anchor = v;
      if (k < 0) return;
      // The first edge decides: drawing over a line erases, anything else draws.
      if (g0.mode < 0) g0.mode = st[k] === 1 ? 0 : 1;
      g0.drew = true;
      if (g0.mode === 1) st[k] = 1;
      else if (st[k] === 1) st[k] = 0;
      after();
      if (!done) render();
    });
    svg.addEventListener('pointerup', (e) => {
      const g0 = drag;
      if (!g0 || e.pointerId !== g0.id) return;
      drag = null;
      if (g0.drew || done) return;
      st[g0.edge] = (st[g0.edge] + 1) % 3;
      after();
      if (!done) render();
    });
    svg.addEventListener('pointercancel', () => (drag = null));

    const sv = ctx.saved as { st?: unknown } | undefined;
    if (Array.isArray(sv?.st) && sv.st.length === E) sv.st.forEach((v, e) => (st[e] = v === 1 || v === 2 ? v : 0));
    root.append(wrap);
    render();
    return { snapshot: () => ({ st }) };
  },
};
