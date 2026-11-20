import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { h, s } from '../core/ui';
import { capture } from './pathkit/grid';
import { crossingEdges, genUntangle, type Pt } from './pathkit/untangle-gen';
import './untangle.css';

export const untangle: PuzzleDef = {
  id: 'untangle',
  get name() {
    return L('Untangle', 'Démêler');
  },
  category: 'paths',
  get rules() {
    return L('Drag the points until no lines cross.', 'Glissez les points pour qu’aucune ligne ne se croise.');
  },
  help: () => ({
    goal: L(
      'Move the points so that no two lines cross. Each line stays attached to its two points.',
      'Déplacez les points pour qu’aucune ligne n’en croise une autre. Chaque ligne reste attachée à ses deux points.',
    ),
    steps: [
      L(
        'Drag a point anywhere in the square; its lines follow it.',
        'Glissez un point n’importe où dans le carré : ses lignes le suivent.',
      ),
      L('Lines that cross another line are shown in red.', 'Les lignes qui en croisent une autre sont en rouge.'),
      L('The status line counts the crossing lines left.', 'La ligne d’état compte les lignes croisées restantes.'),
      L(
        'The puzzle is solved when you let go of a point and nothing crosses.',
        'Le casse-tête est résolu quand vous relâchez un point et que plus rien ne se croise.',
      ),
    ],
    tips: [
      L(
        'Pull a point with few lines out of the tangle first, then place the busier points around it.',
        'Sortez d’abord du fouillis un point qui a peu de lignes, puis placez les points plus chargés autour.',
      ),
      L(
        'Use the whole square: spread the points out, then tidy up.',
        'Servez-vous de tout le carré : étalez les points, puis faites le ménage.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [15, 30, 50, 80, 130]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const { edges, start } = genUntangle(rng, d);
    const V = start.length;
    const pos: Pt[] = start.map((p) => ({ ...p }));
    const sv = ctx.saved as { pos?: unknown } | undefined;
    if (Array.isArray(sv?.pos) && sv.pos.length === V) {
      const ok = sv.pos.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && v >= 0 && v <= 100));
      if (ok) (sv.pos as number[][]).forEach(([x, y], i) => (pos[i] = { x, y }));
    }

    const r = byLevel(d, [4.2, 3.9, 3.6, 3.3, 3]);
    const svg = s('svg', { class: 'untangle', viewBox: '0 0 100 100' });
    const lineG = s('g');
    const dotG = s('g');
    svg.append(lineG, dotG);
    const lines = edges.map(() => {
      const l = s('line');
      lineG.append(l);
      return l;
    });
    const dots = pos.map((_, i) => {
      const c = s('circle', { r, 'data-v': i, class: 'v' });
      dotG.append(c);
      return c;
    });

    let finished = false;
    let drag = -1;
    const render = () => {
      const bad = crossingEdges(pos, edges);
      edges.forEach(([a, b], k) => {
        const l = lines[k];
        l.setAttribute('x1', String(pos[a].x));
        l.setAttribute('y1', String(pos[a].y));
        l.setAttribute('x2', String(pos[b].x));
        l.setAttribute('y2', String(pos[b].y));
        l.setAttribute('class', bad.has(k) ? 'bad' : '');
      });
      dots.forEach((c, i) => {
        c.setAttribute('cx', String(pos[i].x));
        c.setAttribute('cy', String(pos[i].y));
        c.setAttribute('class', `v${i === drag ? ' on' : ''}`);
      });
      const crossings = bad.size;
      ctx.status(
        crossings
          ? P(crossings, ['crossing line', 'crossing lines'], ['ligne croisée', 'lignes croisées'])
          : L('No crossings', 'Aucun croisement'),
      );
      return crossings === 0;
    };

    const toSvg = (e: PointerEvent) => {
      const rc = svg.getBoundingClientRect();
      const clamp = (v: number) => Math.round(Math.max(r, Math.min(100 - r, v)) * 10) / 10;
      return { x: clamp(((e.clientX - rc.left) / (rc.width || 1)) * 100), y: clamp(((e.clientY - rc.top) / (rc.height || 1)) * 100) };
    };
    let grabDx = 0,
      grabDy = 0;
    svg.addEventListener('pointerdown', (e) => {
      if (finished) return;
      let v = Number((e.target as Element | null)?.getAttribute?.('data-v') ?? -1);
      const p = toSvg(e);
      if (!(v >= 0)) {
        // forgiving hit test for fingers
        let bd = r * 2.6;
        v = -1;
        pos.forEach((q, i) => {
          const dd = Math.hypot(q.x - p.x, q.y - p.y);
          if (dd < bd) {
            bd = dd;
            v = i;
          }
        });
      }
      if (v < 0) return;
      ctx.touch();
      drag = v;
      grabDx = pos[v].x - p.x;
      grabDy = pos[v].y - p.y;
      dotG.append(dots[v]); // draw on top
      capture(svg, e.pointerId);
      e.preventDefault();
      render();
    });
    svg.addEventListener('pointermove', (e) => {
      if (drag < 0) return;
      const p = toSvg(e);
      pos[drag] = {
        x: Math.round(Math.max(r, Math.min(100 - r, p.x + grabDx)) * 10) / 10,
        y: Math.round(Math.max(r, Math.min(100 - r, p.y + grabDy)) * 10) / 10,
      };
      render();
    });
    const end = () => {
      if (drag < 0) return;
      drag = -1;
      if (render() && !finished) {
        finished = true;
        ctx.solved();
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    root.append(h('div', { class: 'untangle-wrap' }, svg));
    render();
    return { snapshot: () => ({ pos: pos.map((p) => [p.x, p.y]) }) };
  },
};
