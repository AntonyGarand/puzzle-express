import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';

export const oddshade: PuzzleDef = {
  id: 'oddshade',
  get name() { return L('Odd Shade', 'Teinte intruse'); },
  category: 'memory',
  get rules() { return L('Tap the odd shade out. Three rounds.', 'Touchez la teinte différente. Trois manches.'); },
  help: () => ({
    goal: L(
      'In each grid, one tile is a little lighter or darker than the others. Find it, three times in a row.',
      'Dans chaque grille, une case est un peu plus pâle ou plus foncée que les autres. Trouvez-la, trois fois de suite.',
    ),
    steps: [
      L('All tiles share one colour, except one that is slightly off.', 'Toutes les cases ont la même couleur, sauf une, légèrement différente.'),
      L('Tap the odd tile to move on to the next round. The dots track the three rounds.', 'Touchez la case intruse pour passer à la manche suivante. Les points suivent les trois manches.'),
      L('A wrong tap marks that tile and counts as a mistake.', 'Une mauvaise touche marque la case et compte comme une erreur.'),
      L('Higher levels mean more tiles and a smaller difference.', 'Plus le niveau monte, plus il y a de cases et plus l’écart est faible.'),
    ],
    tips: [
      L('Take in the whole grid at once instead of checking tile by tile: the odd one often pops out.', 'Regardez toute la grille d’un coup plutôt que case par case : l’intruse ressort souvent d’elle-même.'),
      L('Turn up your screen brightness if the shades are very close.', 'Augmentez la luminosité de l’écran si les teintes sont très proches.'),
    ],
  }),
  par: (d) => byLevel(d, [8, 10, 14, 18, 24]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [3, 4, 5, 6, 7]);
    const delta = byLevel(d, [16, 11, 8, 6, 4.5]);
    const total = 3;
    let round = 0;
    let odd = 0;
    let misses: number[] = [];

    const dots = h('div', { class: 'dots' });
    const grid = board(n);
    const cells = Array.from({ length: n * n }, (_, i) => {
      const el = h('button', { type: 'button', class: 'cell swatch-cell', onclick: () => tap(i) });
      grid.append(el);
      return el;
    });
    const newRound = () => {
      const hue = rng.int(0, 359), sat = rng.int(45, 75), light = rng.int(40, 62);
      const oddLight = light + (rng.chance(0.5) ? delta : -delta);
      odd = rng.int(0, n * n - 1);
      misses = [];
      cells.forEach((el, i) => {
        el.classList.remove('miss');
        el.style.background = `hsl(${hue} ${sat}% ${i === odd ? oddLight : light}%)`;
      });
      dots.replaceChildren(...Array.from({ length: total }, (_, k) => h('span', { class: k < round ? 'dot on' : k === round ? 'dot cur' : 'dot' })));
    };
    const tap = (i: number) => {
      ctx.touch();
      if (i === odd) {
        round++;
        if (round >= total) ctx.solved();
        else newRound();
      } else {
        ctx.mistake();
        cells[i].classList.add('miss');
        misses.push(i);
      }
    };
    root.append(dots, grid);
    // Rounds draw from the seeded rng in order, so replay earlier ones to resume on the same board.
    const resumeAt = Math.min((ctx.saved as { round?: number } | undefined)?.round ?? 0, total - 1);
    for (let k = 0; k < resumeAt; k++) newRound();
    round = resumeAt;
    newRound();
    for (const i of (ctx.saved as { misses?: number[] } | undefined)?.misses ?? []) {
      if (cells[i] && i !== odd) {
        cells[i].classList.add('miss');
        misses.push(i);
      }
    }
    return { snapshot: () => ({ round, misses }) };
  },
};
