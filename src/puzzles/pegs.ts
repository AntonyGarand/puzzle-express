import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, shake } from '../core/ui';
import { anim } from './movekit/kit';
import { genPegs, jumps, type Jump } from './playkit/pegs-gen';
import './pegs.css';

export const pegs: PuzzleDef = {
  id: 'pegs',
  get name() {
    return L('Pegs', 'Billes');
  },
  category: 'moves',
  get rules() {
    return L('Jump pegs over each other until only one is left.', 'Sautez les billes par-dessus les autres : gardez-en une.');
  },
  help: () => ({
    goal: L(
      'Remove pegs by jumping over them until a single peg is left. On Master, that last peg must end in the centre hole.',
      'Retirez des billes en sautant par-dessus jusqu’à ce qu’il n’en reste qu’une. En Maître, la dernière doit finir dans le trou du centre.',
    ),
    steps: [
      L(
        'A peg jumps over a neighbouring peg into the empty hole just beyond it; the peg jumped over is removed.',
        'Une bille saute par-dessus une bille voisine et atterrit dans le trou vide juste derrière; la bille sautée est retirée.',
      ),
      L(
        'Jumps go up, down, left or right. On Medium and Expert, diagonal jumps are allowed too.',
        'Les sauts se font vers le haut, le bas, la gauche ou la droite. En Moyen et en Expert, les sauts en diagonale sont aussi permis.',
      ),
      L(
        'Tap a peg to pick it up (its landing holes light up), then tap a lit hole. You can also drag the peg onto the hole.',
        'Touchez une bille pour la prendre (ses trous d’arrivée s’allument), puis touchez un trou allumé. Vous pouvez aussi glisser la bille jusqu’au trou.',
      ),
      L(
        'Undo (Z) takes back a jump; Restart (R) puts every peg back. If no jump is left and more than one peg remains, the game is lost.',
        'Annuler (Z) reprend un saut; Repartir (R) remet toutes les billes. S’il ne reste aucun saut possible et plus d’une bille, la partie est perdue.',
      ),
    ],
    tips: [
      L(
        'Don’t strand pegs alone at the edges: bring the far ones back toward the middle early.',
        'Ne laissez pas de billes isolées sur les bords : ramenez tôt les plus éloignées vers le centre.',
      ),
      L(
        'On the cross, clear one arm at a time and keep the centre busy until the very end.',
        'Sur la croix, videz un bras à la fois et gardez le centre occupé jusqu’à la toute fin.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [40, 70, 120, 180, 420]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const B = genPegs(rng, d);
    const { cols, rows, holes, goal } = B;
    const N = cols * rows;
    const peg = new Array<boolean>(N).fill(false);
    const reset = () => {
      peg.fill(false);
      for (const i of B.pegs) peg[i] = true;
    };
    reset();
    const done: Jump[] = [];
    let sel = -1;
    let over = false;
    let justPicked = false;

    const grid = board(cols, rows, 'pegs-grid');
    const beads: HTMLElement[] = [];
    const cells = Array.from({ length: N }, (_, i) => {
      if (!holes[i]) {
        const el = h('div', { class: 'cell void', 'aria-hidden': 'true' });
        grid.append(el);
        return el;
      }
      const bead = h('span', { class: 'bead' });
      beads[i] = bead;
      const el = h('button', { class: 'cell hole', type: 'button', 'data-i': i, onclick: () => tap(i) }, bead);
      grid.append(el);
      return el;
    });

    const count = () => peg.filter(Boolean).length;
    const targets = () => (sel >= 0 ? jumps(B, peg, sel) : []);
    const render = () => {
      const tg = new Set(targets().map((j) => j.to));
      cells.forEach((el, i) => {
        if (!holes[i]) return;
        el.className = `cell hole${peg[i] ? ' has' : ''}${i === sel ? ' sel' : ''}${tg.has(i) ? ' hint' : ''}${i === goal ? ' goal' : ''}`;
        el.setAttribute(
          'aria-label',
          peg[i] ? L('peg', 'bille') : tg.has(i) ? L('landing hole', 'trou d’arrivée') : L('empty hole', 'trou vide'),
        );
      });
      const left = count();
      ctx.status(
        `${P(left, ['peg left', 'pegs left'], ['bille restante', 'billes restantes'])}${goal >= 0 ? L(' · finish in the centre', ' · finissez au centre') : ''}`,
      );
    };

    const play = (j: Jump, animate = true) => {
      peg[j.from] = peg[j.over] = false;
      peg[j.to] = true;
      done.push(j);
      sel = -1;
      if (!animate) return;
      render();
      const a = cells[j.from],
        b = cells[j.to];
      const dx = a.offsetLeft - b.offsetLeft,
        dy = a.offsetTop - b.offsetTop;
      anim(
        beads[j.to],
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.25)`, offset: 0.5 },
          { transform: 'none' },
        ],
        240,
      );
      const left = count();
      if (left === 1 && (goal < 0 || peg[goal])) {
        over = true;
        ctx.solved();
      } else if (!jumps(B, peg).length) {
        over = true;
        shake(grid);
        ctx.status(L('No jumps left', 'Plus aucun saut possible'));
        ctx.failed();
      }
    };

    const tap = (i: number) => {
      if (over) return;
      if (justPicked && i === sel) {
        justPicked = false;
        return;
      }
      justPicked = false;
      const j = targets().find((t) => t.to === i);
      if (j) {
        ctx.touch();
        play(j);
        return;
      }
      if (peg[i] && i !== sel) {
        sel = i;
        if (!targets().length) shake(cells[i]);
      } else sel = -1;
      render();
    };

    // Drag: press a peg (it gets picked up), release over a lit hole.
    grid.style.touchAction = 'none';
    grid.addEventListener('pointerdown', (e) => {
      if (over) return;
      const el = (e.target as Element).closest<HTMLElement>('[data-i]');
      const i = el ? Number(el.dataset.i) : -1;
      if (i < 0 || !peg[i] || i === sel) return;
      ctx.touch();
      sel = i;
      justPicked = true;
      render();
    });
    grid.addEventListener('pointerup', (e) => {
      if (over || sel < 0) return;
      const el = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]');
      const i = el && grid.contains(el) ? Number(el.dataset.i) : -1;
      const j = targets().find((t) => t.to === i);
      if (!j) return;
      justPicked = false;
      play(j);
    });

    const undo = () => {
      if (over || !done.length) return;
      const j = done.pop()!;
      peg[j.from] = peg[j.over] = true;
      peg[j.to] = false;
      sel = -1;
      render();
    };
    const restart = () => {
      if (over) return;
      reset();
      done.length = 0;
      sel = -1;
      render();
    };
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'), btn(L('Restart', 'Repartir'), restart, 'ghost'));

    const sv = ctx.saved as { moves?: unknown; sel?: unknown } | undefined;
    if (Array.isArray(sv?.moves)) {
      for (const m of sv.moves) {
        if (!Array.isArray(m)) break;
        const j = jumps(B, peg, m[0]).find((t) => t.to === m[1]);
        if (!j) break;
        play(j, false);
      }
      if (Number.isInteger(sv.sel) && peg[sv.sel as number]) sel = sv.sel as number;
    }
    root.append(grid);
    render();
    return {
      snapshot: () => ({ moves: done.map((j) => [j.from, j.to]), sel }),
      onKey(e) {
        const k = e.key.toLowerCase();
        if (k === 'z' || k === 'backspace') undo();
        else if (k === 'r') restart();
        else if (k === 'escape' && sel >= 0) {
          sel = -1;
          render();
        } else return false;
        return true;
      },
    };
  },
};
