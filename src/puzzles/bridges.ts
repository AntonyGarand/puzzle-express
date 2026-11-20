import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { h, s, shake } from '../core/ui';
import { connected, genBridges } from './logickit/bridgesgen';
import './bridges.css';

const R = 0.42; // island radius in cell units

export const bridges: PuzzleDef = {
  id: 'bridges',
  get name() {
    return L('Bridges', 'Ponts');
  },
  category: 'logic',
  get rules() {
    return L('Link islands with up to 2 straight bridges; join them all.', 'Reliez toutes les îles avec 1 ou 2 ponts droits.');
  },
  help: () => ({
    goal: L(
      'Connect all the islands into one network. Each island’s number is how many bridges end at it.',
      'Reliez toutes les îles en un seul réseau. Le nombre de chaque île indique combien de ponts y aboutissent.',
    ),
    steps: [
      L(
        'Bridges run straight across or down between two islands. They can’t cross each other.',
        'Les ponts vont en ligne droite, horizontale ou verticale, entre deux îles. Ils ne peuvent pas se croiser.',
      ),
      L('Two islands can share at most 2 bridges.', 'Deux îles peuvent partager au plus 2 ponts.'),
      L(
        'Drag from an island toward a neighbour, or tap one island then the other. Repeat to go 1 → 2 → none.',
        'Glissez d’une île vers une voisine, ou touchez une île puis l’autre. Répétez pour passer de 1 à 2, puis à aucun.',
      ),
      L('You can also tap a bridge to change it the same way.', 'Vous pouvez aussi toucher un pont pour le modifier de la même façon.'),
      L(
        'Complete islands change colour; islands with too many bridges are marked.',
        'Les îles complètes changent de couleur; celles qui ont trop de ponts sont signalées.',
      ),
    ],
    tips: [
      L(
        'Start with islands that have few neighbours: a 4 with only two neighbours needs a double bridge to each.',
        'Commencez par les îles qui ont peu de voisines : un 4 avec seulement deux voisines a besoin d’un pont double vers chacune.',
      ),
      L(
        'Don’t close off a small group: every island must end up connected.',
        'Ne fermez pas un petit groupe sur lui-même : toutes les îles doivent être reliées.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [45, 80, 130, 200, 320]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [7, 9, 10, 11, 13]);
    const target = byLevel(d, [8, 12, 16, 21, 28]);
    const p = genBridges(n, target, rng);
    const { islands, edges, cross, inc } = p;
    const b = new Array<number>(edges.length).fill(0);
    let sel = -1;
    let done = false;

    const pairKey = (a: number, c: number) => `${Math.min(a, c)},${Math.max(a, c)}`;
    const edgeOf = new Map(edges.map((e, k) => [pairKey(e.a, e.b), k]));

    const pad = 0.72;
    const vb = { x: -pad, y: -pad, w: n - 1 + 2 * pad };
    const svg = s('svg', { viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.w}`, class: 'lk-bsvg' });
    const gHit = s('g', { class: 'hits' });
    const gBr = s('g', { class: 'brs' });
    const gIsl = s('g', { class: 'isls' });
    svg.append(gHit, gBr, gIsl);
    edges.forEach((e, k) => {
      const A = islands[e.a],
        B = islands[e.b];
      gHit.append(s('line', { x1: A.c, y1: A.r, x2: B.c, y2: B.r, class: 'hit', 'data-e': k }));
    });
    const islEls = islands.map((isl, i) => {
      const g = s(
        'g',
        { class: 'isl', 'data-i': i },
        s('circle', { cx: isl.c, cy: isl.r, r: R }),
        s('text', { x: isl.c, y: isl.r, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, isl.need),
      );
      gIsl.append(g);
      return g;
    });
    const wrap = h('div', { class: 'lk-bridges' }, svg);

    const render = () => {
      gBr.replaceChildren();
      edges.forEach((e, k) => {
        if (!b[k]) return;
        const A = islands[e.a],
          B = islands[e.b];
        const offs = b[k] === 2 ? [-0.11, 0.11] : [0];
        for (const o of offs) {
          const [x1, y1, x2, y2] = e.horiz ? [A.c + R, A.r + o, B.c - R, B.r + o] : [A.c + o, A.r + R, B.c + o, B.r - R];
          gBr.append(s('line', { x1, y1, x2, y2, class: 'br' }));
        }
      });
      let ok = 0;
      islEls.forEach((g, i) => {
        const sum = inc[i].reduce((t, e) => t + b[e], 0);
        const need = islands[i].need;
        ok += sum === need ? 1 : 0;
        g.setAttribute('class', `isl${sum === need ? ' done' : sum > need ? ' err' : ''}${sel === i ? ' sel' : ''}`);
      });
      ctx.status(L(`${ok} / ${islands.length} islands`, `${ok} / ${islands.length} îles`));
      return ok === islands.length && connected(islands.length, edges, b);
    };

    const cycle = (k: number) => {
      const nv = (b[k] + 1) % 3;
      if (nv > 0 && cross[k].some((f) => b[f] > 0)) {
        shake(wrap);
        return;
      }
      b[k] = nv;
    };
    const after = () => {
      if (render() && !done) {
        done = true;
        sel = -1;
        render();
        ctx.solved();
      }
    };
    const tapIsland = (i: number) => {
      if (sel < 0 || sel === i) sel = sel === i ? -1 : i;
      else {
        const k = edgeOf.get(pairKey(sel, i));
        if (k == null) sel = i;
        else {
          cycle(k);
          sel = -1;
        }
      }
      after();
    };
    /** Neighbour edge of island `i` in the drag direction. */
    const edgeToward = (i: number, dx: number, dy: number) => {
      const horiz = Math.abs(dx) >= Math.abs(dy);
      const sign = Math.sign(horiz ? dx : dy);
      return inc[i].find((k) => {
        const e = edges[k];
        if (e.horiz !== horiz) return false;
        const o = islands[e.a === i ? e.b : e.a],
          me = islands[i];
        return Math.sign(horiz ? o.c - me.c : o.r - me.r) === sign;
      });
    };

    // Pointer handling: tap island → tap neighbour, or drag island → island; tap a bridge to cycle it.
    const toUnits = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      if (!(rect.width > 0) || !(e.clientX || e.clientY)) return null;
      return { x: vb.x + ((e.clientX - rect.left) / rect.width) * vb.w, y: vb.y + ((e.clientY - rect.top) / rect.height) * vb.w };
    };
    const islandAt = (e: PointerEvent) => {
      const pt = toUnits(e);
      if (!pt) {
        const t = (e.target as Element | null)?.closest?.('[data-i]');
        return t ? Number(t.getAttribute('data-i')) : -1;
      }
      let best = -1,
        bd = 0.62;
      islands.forEach((isl, i) => {
        const dd = Math.hypot(isl.c - pt.x, isl.r - pt.y);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });
      return best;
    };
    let down = -1,
      downEdge = -1,
      start: { x: number; y: number } | null = null;
    svg.addEventListener('pointerdown', (e) => {
      if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
      ctx.touch();
      down = islandAt(e);
      const t = (e.target as Element | null)?.closest?.('[data-e]');
      downEdge = down < 0 && t ? Number(t.getAttribute('data-e')) : -1;
      start = toUnits(e);
      if (down >= 0 || downEdge >= 0) {
        e.preventDefault();
        try {
          svg.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
      }
    });
    svg.addEventListener('pointerup', (e) => {
      if (done) return;
      const a = down,
        k0 = downEdge;
      down = downEdge = -1;
      if (a < 0) {
        if (k0 >= 0) {
          sel = -1;
          cycle(k0);
          after();
        }
        return;
      }
      const up = islandAt(e);
      const pt = toUnits(e);
      const moved = start && pt ? Math.hypot(pt.x - start.x, pt.y - start.y) : 0;
      if (up === a || (up < 0 && moved < 0.45)) return tapIsland(a);
      if (up >= 0) {
        const k = edgeOf.get(pairKey(a, up));
        if (k != null) {
          cycle(k);
          sel = -1;
          after();
          return;
        }
        return tapIsland(up);
      }
      const k = start && pt ? edgeToward(a, pt.x - start.x, pt.y - start.y) : undefined;
      if (k != null) {
        cycle(k);
        sel = -1;
        after();
      }
    });
    svg.addEventListener('pointercancel', () => {
      down = downEdge = -1;
    });

    const sv = ctx.saved as { b?: unknown; sel?: unknown } | undefined;
    if (Array.isArray(sv?.b) && sv.b.length === b.length) {
      sv.b.forEach((v, k) => (b[k] = v === 1 || v === 2 ? v : 0));
      // Drop any crossing pairs from a corrupt save.
      b.forEach((v, k) => {
        if (v && cross[k].some((f) => f < k && b[f])) b[k] = 0;
      });
    }
    if (Number.isInteger(sv?.sel) && (sv!.sel as number) >= -1 && (sv!.sel as number) < islands.length) sel = sv!.sel as number;
    root.append(wrap);
    render();
    return { snapshot: () => ({ b, sel }) };
  },
};
