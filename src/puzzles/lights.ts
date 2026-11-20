import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';

export const lights: PuzzleDef = {
  id: 'lights',
  get name() {
    return L('Lights', 'Lumières');
  },
  category: 'logic',
  get rules() {
    return L('A tap flips a tile and its neighbours. Lights out!', 'Une touche inverse la case et ses voisines. Éteignez tout!');
  },
  help: () => ({
    goal: L('Switch off every light on the board.', 'Éteignez toutes les lumières de la grille.'),
    steps: [
      L(
        'Tapping a tile flips it, along with the tiles directly above, below, left and right of it.',
        'Toucher une case l’inverse, ainsi que les cases juste au-dessus, au-dessous, à gauche et à droite.',
      ),
      L(
        'Lit tiles are coloured. You win when none are left.',
        'Les cases allumées sont en couleur. Vous gagnez quand il n’en reste aucune.',
      ),
      L(
        'The status line shows your moves and how many tiles are still lit.',
        'La ligne d’état affiche vos coups et le nombre de cases encore allumées.',
      ),
      L(
        'Higher levels mean bigger boards and more scrambled starts.',
        'Les niveaux supérieurs donnent des grilles plus grandes et plus mélangées.',
      ),
    ],
    tips: [
      L(
        'Tapping the same tile twice cancels out, and the order of taps doesn’t matter.',
        'Toucher deux fois la même case l’annule, et l’ordre des touches n’a pas d’importance.',
      ),
      L(
        'Chase the lights down: clear each row by tapping the tiles just below its lit ones.',
        'Poussez les lumières vers le bas : videz chaque rangée en touchant les cases juste sous ses lumières.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [15, 30, 60, 100, 160]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [3, 4, 5, 5, 6]);
    const presses = byLevel(d, [2, 4, 6, 9, 13]);
    const on = new Array(n * n).fill(false);
    let moves = 0;

    const toggle = (i: number) => {
      const r = Math.floor(i / n),
        c = i % n;
      for (const [dr, dc] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const rr = r + dr,
          cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) on[rr * n + cc] = !on[rr * n + cc];
      }
    };
    do {
      on.fill(false);
      for (const i of rng.shuffle([...on.keys()]).slice(0, presses)) toggle(i);
    } while (!on.some(Boolean));

    const grid = board(n);
    const cells = on.map((_, i) => {
      const el = h('button', { type: 'button', class: 'cell', 'aria-label': L(`tile ${i + 1}`, `case ${i + 1}`), onclick: () => press(i) });
      grid.append(el);
      return el;
    });
    const render = () => {
      cells.forEach((el, i) => el.classList.toggle('on', on[i]));
      const lit = on.filter(Boolean).length;
      ctx.status(`${P(moves, ['move', 'moves'], ['coup', 'coups'])} · ${P(lit, ['lit', 'lit'], ['allumée', 'allumées'])}`);
    };
    const press = (i: number) => {
      ctx.touch();
      toggle(i);
      moves++;
      render();
      if (!on.some(Boolean)) ctx.solved();
    };
    const sv = ctx.saved as { on?: boolean[]; moves?: number } | undefined;
    if (sv?.on?.length === on.length) {
      sv.on.forEach((v, i) => (on[i] = v));
      moves = sv.moves ?? 0;
    }
    root.append(grid);
    render();
    return { snapshot: () => ({ on, moves }) };
  },
};
