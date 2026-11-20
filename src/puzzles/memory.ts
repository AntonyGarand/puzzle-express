import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';

export const memory: PuzzleDef = {
  id: 'memory',
  get name() {
    return L('Memory', 'Mémoire');
  },
  category: 'memory',
  get rules() {
    return L('Memorise the lit tiles, then tap them. Three lives.', 'Retenez les cases allumées, puis touchez-les. Trois vies.');
  },
  help: () => ({
    goal: L('Remember which tiles light up, then find them all again.', 'Retenez quelles cases s’allument, puis retrouvez-les toutes.'),
    steps: [
      L('When the game appears, some tiles light up for a moment.', 'Quand le jeu s’affiche, quelques cases s’allument un instant.'),
      L('Once they go dark, tap every tile that was lit.', 'Une fois éteintes, touchez toutes les cases qui étaient allumées.'),
      L(
        'A wrong tile is marked and costs one of your three lives (●).',
        'Une mauvaise case est marquée et vous coûte une de vos trois vies (●).',
      ),
      L(
        'Lose all three and the tiles you missed are shown. Higher levels mean a bigger grid and more tiles.',
        'Si vous les perdez toutes, les cases manquées sont révélées. Plus le niveau monte, plus la grille et le nombre de cases grandissent.',
      ),
    ],
    tips: [
      L(
        'See the lit tiles as a shape or pattern instead of remembering them one by one.',
        'Voyez les cases allumées comme une forme plutôt que de les retenir une par une.',
      ),
      L('Tap the ones you’re sure of first.', 'Touchez d’abord celles dont vous êtes sûr.'),
    ],
  }),
  par: (d) => byLevel(d, [8, 10, 14, 18, 24]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [3, 4, 4, 5, 6]);
    const k = byLevel(d, [3, 5, 6, 8, 11]);
    const showMs = byLevel(d, [1400, 1500, 1500, 1800, 2200]);
    const targets = new Set(rng.shuffle([...Array(n * n).keys()]).slice(0, k));
    const found = new Set<number>();
    let lives = 3;
    let phase: 'wait' | 'show' | 'play' | 'over' = 'wait';
    let timer = 0;

    const grid = board(n);
    const cells = Array.from({ length: n * n }, (_, i) => {
      const el = h('button', { type: 'button', class: 'cell', onclick: () => tap(i) });
      grid.append(el);
      return el;
    });
    const status = () =>
      ctx.status(
        phase === 'play'
          ? `${L(`${k - found.size} to find`, `${k - found.size} à trouver`)} · ${'●'.repeat(lives)}${'○'.repeat(3 - lives)}`
          : phase === 'show'
            ? L('Remember…', 'Mémorisez…')
            : L('Get ready', 'Préparez-vous'),
      );
    const reveal = (on: boolean) => targets.forEach((i) => cells[i].classList.toggle('on', on));

    const start = () => {
      if (phase !== 'wait') return;
      phase = 'show';
      status();
      timer = window.setTimeout(() => {
        reveal(true);
        timer = window.setTimeout(() => {
          reveal(false);
          phase = 'play';
          status();
        }, showMs);
      }, 500);
    };
    const tap = (i: number) => {
      if (phase !== 'play' || found.has(i) || cells[i].classList.contains('miss')) return;
      ctx.touch();
      if (targets.has(i)) {
        found.add(i);
        cells[i].classList.add('on');
        status();
        if (found.size === k) {
          phase = 'over';
          ctx.solved();
        }
      } else {
        lives--;
        ctx.mistake();
        cells[i].classList.add('miss');
        status();
        if (lives === 0) {
          phase = 'over';
          targets.forEach((t) => !found.has(t) && cells[t].classList.add('hint'));
          ctx.failed();
        }
      }
    };
    root.append(grid);
    status();
    return {
      activate: start,
      destroy: () => clearTimeout(timer),
    };
  },
};
