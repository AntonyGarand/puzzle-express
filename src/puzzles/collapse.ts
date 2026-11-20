import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, PALETTE, shake } from '../core/ui';
import { anim } from './movekit/kit';
import { genCollapse, groupAt, hasMove, removeCells, type Cols } from './playkit/collapse-gen';
import './collapse.css';

/** Palette slots used for the blocks (well apart from each other in both themes). */
const TONES = [0, 1, 2, 4, 6];

export const collapse: PuzzleDef = {
  id: 'collapse',
  get name() {
    return L('Collapse', 'Avalanche');
  },
  category: 'moves',
  get rules() {
    return L('Tap groups of 2+ same-colour blocks to clear the board.', 'Touchez les groupes de 2+ blocs pareils : videz la grille.');
  },
  help: () => ({
    goal: L(
      'Clear the board by removing groups of touching blocks of the same colour. On Easy and Medium, leaving a few blocks is enough; from Hard on, every block must go.',
      'Videz la grille en retirant les groupes de blocs voisins de la même couleur. En Facile et Moyen, il suffit de laisser peu de blocs; dès Difficile, il faut tout retirer.',
    ),
    steps: [
      L(
        'Tap a block that touches at least one block of its colour (up, down, left or right): the whole group disappears.',
        'Touchez un bloc qui touche au moins un bloc de sa couleur (en haut, en bas, à gauche ou à droite) : tout le groupe disparaît.',
      ),
      L(
        'Blocks above fall into the gaps, and empty columns close up to the left.',
        'Les blocs au-dessus tombent dans les trous, et les colonnes vides se referment vers la gauche.',
      ),
      L(
        'A group of n blocks scores (n − 2)²: bigger groups are worth much more.',
        'Un groupe de n blocs vaut (n − 2)² points : les gros groupes rapportent beaucoup plus.',
      ),
      L(
        'The game ends when no group is left: you win if the blocks left meet the goal shown below the board. Undo (Z) takes back a move.',
        'La partie se termine quand il ne reste plus de groupe : vous gagnez si les blocs restants respectent l’objectif affiché sous la grille. Annuler (Z) reprend un coup.',
      ),
    ],
    tips: [
      L(
        'Look for lone blocks first and plan how to bring a partner next to them.',
        'Repérez d’abord les blocs isolés et prévoyez comment leur amener un partenaire.',
      ),
      L(
        'Removing a group under another can merge two groups of the same colour into a bigger one.',
        'Retirer un groupe sous un autre peut réunir deux groupes de même couleur en un plus gros.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [40, 70, 120, 180, 260]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const W = byLevel(d, [6, 7, 8, 9, 10]);
    const H = W;
    const k = byLevel(d, [3, 3, 4, 4, 5]);
    const target = byLevel(d, [6, 2, 0, 0, 0]);
    const start: Cols = genCollapse(rng, W, H, k).cols;
    // Block identities, so moves can animate each block from where it was.
    let nextId = 0;
    const startIds = start.map((col) => col.map(() => nextId++));

    let cols: Cols = [];
    let ids: number[][] = [];
    let score = 0;
    const moves: number[] = [];
    let over = false;

    const grid = board(W, H, 'collapse-grid');
    const cells = Array.from({ length: W * H }, (_, i) => {
      const el = h('div', { class: 'cell', 'data-i': i, onclick: () => tapCell(i) });
      grid.append(el);
      return el;
    });
    const goalEl = h('div', { class: 'collapse-goal' });
    const at = (i: number): [number, number] => [i % W, H - 1 - Math.floor(i / W)];
    const left = () => cols.reduce((a, col) => a + col.length, 0);

    const render = () => {
      cells.forEach((el, i) => {
        const [x, y] = at(i);
        const c = cols[x]?.[y];
        if (c == null) {
          el.className = 'cell empty';
          el.removeAttribute('style');
        } else {
          el.className = 'cell block';
          el.setAttribute('style', `--c:${PALETTE[TONES[c]]}`);
        }
      });
      const n = left();
      goalEl.textContent =
        target > 0
          ? L(`Goal: ${target} blocks or fewer left`, `Objectif : ${target} blocs ou moins restants`)
          : L('Goal: clear every block', 'Objectif : retirer tous les blocs');
      goalEl.classList.toggle('met', n <= target);
      ctx.status(
        `${L(`Score ${score}`, `Pointage ${score}`)} · ${P(n, ['block left', 'blocks left'], ['bloc restant', 'blocs restants'])}`,
      );
    };

    /** Apply a move (display cell index); returns the removed group or null if illegal. */
    const apply = (i: number) => {
      const [x, y] = at(i);
      const grp = groupAt(cols, x, y);
      if (grp.length < 2) return null;
      const gone = new Set(grp.map(([a, b]) => `${a},${b}`));
      ids = ids.map((col, a) => col.filter((_, b) => !gone.has(`${a},${b}`))).filter((col) => col.length);
      cols = removeCells(cols, grp);
      score += (grp.length - 2) ** 2;
      moves.push(i);
      return grp;
    };
    const reset = () => {
      cols = start.map((col) => col.slice());
      ids = startIds.map((col) => col.slice());
      score = 0;
      moves.length = 0;
    };

    const finish = () => {
      if (hasMove(cols)) return;
      over = true;
      if (left() <= target) ctx.solved();
      else {
        shake(grid);
        ctx.status(L(`No groups left · ${left()} blocks remain`, `Plus aucun groupe · il reste ${left()} blocs`));
        ctx.failed();
      }
    };

    const tapCell = (i: number) => {
      if (over) return;
      const before = new Map<number, [number, number]>();
      ids.forEach((col, x) => col.forEach((id, y) => before.set(id, [x, y])));
      const grp = apply(i);
      if (!grp) {
        if (cols[at(i)[0]]?.[at(i)[1]] != null) shake(cells[i]);
        return;
      }
      ctx.touch();
      clearHover();
      render();
      // Each block slides from its old slot to its new one.
      const px = cells[1].offsetLeft - cells[0].offsetLeft,
        py = cells[W].offsetTop - cells[0].offsetTop;
      ids.forEach((col, x) =>
        col.forEach((id, y) => {
          const [ox, oy] = before.get(id)!;
          if (ox === x && oy === y) return;
          const el = cells[(H - 1 - y) * W + x];
          anim(
            el,
            [{ transform: `translate(${(ox - x) * px}px, ${(y - oy) * py}px)` }, { transform: 'none' }],
            120 + 40 * Math.max(oy - y, ox - x),
          );
        }),
      );
      finish();
    };

    // Mouse hover previews the group under the pointer.
    let hovered: HTMLElement[] = [];
    const clearHover = () => {
      for (const el of hovered) el.classList.remove('same');
      hovered = [];
    };
    grid.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || over) return;
      const el = (e.target as Element).closest<HTMLElement>('[data-i]');
      clearHover();
      if (!el) return;
      const [x, y] = at(Number(el.dataset.i));
      const grp = groupAt(cols, x, y);
      if (grp.length < 2) return;
      hovered = grp.map(([a, b]) => cells[(H - 1 - b) * W + a]);
      for (const c of hovered) c.classList.add('same');
    });
    grid.addEventListener('pointerleave', clearHover);

    const undo = () => {
      if (over || !moves.length) return;
      const keep = moves.slice(0, -1);
      reset();
      for (const m of keep) apply(m);
      render();
    };
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'));

    reset();
    const sv = ctx.saved as { moves?: unknown } | undefined;
    if (Array.isArray(sv?.moves)) for (const m of sv.moves) if (!Number.isInteger(m) || !apply(m as number)) break;
    root.append(grid, goalEl);
    render();
    return {
      snapshot: () => ({ moves }),
      onKey(e) {
        if (e.key !== 'z' && e.key !== 'Z' && e.key !== 'Backspace') return false;
        undo();
        return true;
      },
    };
  },
};
