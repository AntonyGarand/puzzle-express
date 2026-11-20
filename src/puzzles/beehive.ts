import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, s, shake } from '../core/ui';
import { genBeehive } from './pathkit/beehive-gen';
import { capture } from './pathkit/grid';
import './beehive.css';

const SQ3 = Math.sqrt(3);

export const beehive: PuzzleDef = {
  id: 'beehive',
  get name() {
    return L('Beehive', 'Ruche');
  },
  category: 'paths',
  get rules() {
    return L('Count 1 to N through touching hexes. Tap to step.', 'Comptez de 1 à N d’un hexagone voisin à l’autre.');
  },
  help: () => ({
    goal: L(
      'Fill every hex with the numbers 1 to N so that each number touches the next one. Some numbers are already given.',
      'Remplissez chaque hexagone avec les nombres de 1 à N : chaque nombre doit toucher le suivant. Certains nombres sont déjà donnés.',
    ),
    steps: [
      L(
        'Your chain starts at 1. Tap a neighbouring hex to place the next number there.',
        'Votre chaîne part de 1. Touchez un hexagone voisin pour y placer le nombre suivant.',
      ),
      L('You can also drag across several hexes in a row.', 'Vous pouvez aussi glisser le doigt sur plusieurs hexagones d’affilée.'),
      L(
        'A given number must be reached exactly on its turn: you can’t pass it early, and when it’s next, you must step onto it.',
        'Un nombre donné doit être atteint pile à son tour : impossible d’y passer trop tôt, et quand c’est lui le suivant, vous devez y aller.',
      ),
      L('Highlighted hexes show where the next number can go.', 'Les hexagones en surbrillance montrent où peut aller le prochain nombre.'),
      L(
        'Tap a placed number to rewind to it. Undo removes the last number; Reset starts over from 1.',
        'Touchez un nombre placé pour revenir à lui. Annuler retire le dernier nombre; Repartir revient à 1.',
      ),
    ],
    tips: [
      L(
        'Aim for the next given number: your path must reach it in exactly the right number of steps.',
        'Visez le prochain nombre donné : votre chemin doit l’atteindre en exactement le bon nombre de pas.',
      ),
      L(
        'Don’t leave a lone hex behind you; you can never come back for it.',
        'Ne laissez pas d’hexagone isolé derrière vous : vous ne pourrez plus y revenir.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [30, 60, 90, 150, 220]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const P = genBeehive(rng, d);
    const { cells, adj, givens } = P;
    const N = cells.length;
    const givenAt = new Map<number, number>(); // number -> cell
    givens.forEach((g, i) => g && givenAt.set(g, i));
    const chain: number[] = [givenAt.get(1)!];

    // ---- layout ----
    const cx = cells.map((c) => SQ3 * (c.q + c.r / 2));
    const cy = cells.map((c) => 1.5 * c.r);
    const pad = 0.25;
    const minX = Math.min(...cx) - SQ3 / 2 - pad,
      maxX = Math.max(...cx) + SQ3 / 2 + pad;
    const minY = Math.min(...cy) - 1 - pad,
      maxY = Math.max(...cy) + 1 + pad;
    const vw = maxX - minX,
      vh = maxY - minY;
    const svg = s('svg', { class: 'beehive', viewBox: `${minX} ${minY} ${vw} ${vh}`, style: `aspect-ratio:${vw}/${vh}` });
    const corners = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k + 30);
      return [Math.cos(a) * 0.93, Math.sin(a) * 0.93];
    });
    const fs = N > 40 ? 0.78 : 0.86;
    const groups = cells.map((_, i) => {
      const t = s('text', { x: cx[i], y: cy[i], 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      const g = s(
        'g',
        { class: 'hex', 'data-i': i },
        s('polygon', { points: corners.map(([x, y]) => `${(cx[i] + x).toFixed(3)},${(cy[i] + y).toFixed(3)}`).join(' ') }),
        t,
      );
      svg.append(g);
      return { g, t };
    });

    let finished = false;
    const render = () => {
      const pos = new Map<number, number>();
      chain.forEach((c, k) => pos.set(c, k));
      const end = chain[chain.length - 1];
      const next = chain.length + 1;
      groups.forEach(({ g, t }, i) => {
        const k = pos.get(i);
        const num = givens[i] || (k != null ? k + 1 : 0);
        t.textContent = num ? String(num) : '';
        const canStep = !finished && k == null && adj[end].includes(i) && (givens[i] ? givens[i] === next : !givenAt.has(next));
        g.setAttribute(
          'class',
          `hex${givens[i] ? ' given' : ''}${k != null ? ' placed' : ''}${i === end ? ' end' : ''}${canStep ? ' next' : ''}`,
        );
      });
      ctx.status(`${chain.length} / ${N}`);
      return chain.length === N;
    };
    const check = () => {
      if (render() && !finished) {
        finished = true;
        render();
        ctx.solved();
      }
    };

    /** Act on a hex; `drag` is true for cells entered while dragging (no rewinds except one step back). */
    const act = (i: number, drag: boolean): boolean => {
      if (finished || i < 0) return false;
      const at = chain.indexOf(i);
      const end = chain[chain.length - 1];
      if (at >= 0) {
        if (at === chain.length - 1) return true;
        if (drag && at !== chain.length - 2) return false;
        chain.length = at + 1;
        return true;
      }
      if (!adj[end].includes(i)) return false;
      const next = chain.length + 1;
      if (givens[i] ? givens[i] !== next : givenAt.has(next)) return false;
      chain.push(i);
      return true;
    };

    // ---- pointer: tap or drag across hexes ----
    let dragging = false;
    const hexAt = (e: PointerEvent): number => {
      const el = (e.target as Element | null)?.closest?.('[data-i]');
      if (el && svg.contains(el) && e.type === 'pointerdown') return Number(el.getAttribute('data-i'));
      const r = svg.getBoundingClientRect();
      if (!r.width) return -1;
      const x = minX + ((e.clientX - r.left) / r.width) * vw;
      const y = minY + ((e.clientY - r.top) / r.height) * vh;
      let best = -1,
        bd = 0.8;
      for (let i = 0; i < N; i++) {
        const dd = Math.hypot(cx[i] - x, cy[i] - y);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      return best;
    };
    svg.addEventListener('pointerdown', (e) => {
      const i = hexAt(e);
      if (i < 0 || finished) return;
      ctx.touch();
      e.preventDefault();
      if (act(i, false)) {
        dragging = true;
        capture(svg, e.pointerId);
      } else {
        shake(svg);
      }
      check();
    });
    svg.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const i = hexAt(e);
      if (i >= 0 && i !== chain[chain.length - 1] && act(i, true)) check();
    });
    const end = () => (dragging = false);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    ctx.controls(
      btn(
        L('Undo', 'Annuler'),
        () => {
          if (!finished && chain.length > 1) {
            chain.pop();
            render();
          }
        },
        'ghost',
      ),
      btn(
        L('Reset', 'Repartir'),
        () => {
          if (!finished) {
            chain.length = 1;
            render();
          }
        },
        'ghost',
      ),
    );

    // ---- resume: replay the saved chain through the same rules ----
    const sv = ctx.saved as { chain?: unknown } | undefined;
    if (Array.isArray(sv?.chain) && sv.chain[0] === chain[0]) {
      for (const v of sv.chain.slice(1)) if (!Number.isInteger(v) || chain.includes(v as number) || !act(v as number, false)) break;
      if (chain.length === N) chain.pop(); // never resume into an already-solved state
    }
    root.append(h('div', { class: 'beehive-wrap' }, svg));
    render();
    return { snapshot: () => ({ chain }) };
  },
};
