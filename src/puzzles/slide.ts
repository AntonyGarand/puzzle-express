import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';

export const slide: PuzzleDef = {
  id: 'slide',
  get name() { return L('Slide', 'Taquin'); },
  category: 'moves',
  get rules() { return L('Slide the tiles back into order.', 'Glissez les tuiles pour les remettre en ordre.'); },
  help: () => ({
    goal: L(
      'Put the numbered tiles back in order, 1 at the top left, with the gap in the bottom-right corner.',
      'Remettez les tuiles numérotées en ordre, le 1 en haut à gauche et le trou en bas à droite.',
    ),
    steps: [
      L('Tap a tile in the same row or column as the gap: it slides into the gap, along with any tiles in between.', 'Touchez une tuile sur la même rangée ou colonne que le trou : elle glisse vers le trou, avec les tuiles entre les deux.'),
      L('Tiles that are already in their home spot are highlighted.', 'Les tuiles déjà à leur place sont mises en couleur.'),
      L('Keyboard: an arrow key slides the tile next to the gap in that direction.', 'Clavier : une flèche fait glisser dans cette direction la tuile voisine du trou.'),
      L('The status line counts your moves. Higher levels go from 3×3 to 4×4 and shuffle more.', 'La ligne d’état compte vos coups. Les niveaux supérieurs passent de 3×3 à 4×4 et mélangent davantage.'),
    ],
    tips: [
      L('Solve the top row first, then the left column, then repeat on the smaller square that’s left.', 'Placez d’abord la rangée du haut, puis la colonne de gauche, et recommencez sur le carré restant.'),
      L('Place the last two tiles of a row together: line them up below their spots, then swing them in.', 'Placez les deux dernières tuiles d’une rangée ensemble : alignez-les sous leur place, puis faites-les entrer.'),
    ],
  }),
  par: (d) => byLevel(d, [20, 45, 90, 150, 240]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [3, 3, 3, 4, 4]);
    const shuffles = byLevel(d, [10, 25, 80, 50, 160]);
    const tiles = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n)); // 0 = gap
    let gap = n * n - 1;
    let moves = 0;

    const neighbours = (i: number) => {
      const r = Math.floor(i / n), c = i % n, out: number[] = [];
      if (r > 0) out.push(i - n);
      if (r < n - 1) out.push(i + n);
      if (c > 0) out.push(i - 1);
      if (c < n - 1) out.push(i + 1);
      return out;
    };
    const solved = () => tiles.every((t, i) => t === (i + 1) % (n * n));
    do {
      let prev = -1;
      for (let k = 0; k < shuffles; k++) {
        const opts = neighbours(gap).filter((x) => x !== prev);
        const x = rng.pick(opts);
        [tiles[gap], tiles[x]] = [tiles[x], tiles[gap]];
        prev = gap;
        gap = x;
      }
    } while (solved());

    const grid = board(n);
    const cells = tiles.map((_, i) => {
      const el = h('button', { type: 'button', class: 'cell tile', onclick: () => tap(i) });
      grid.append(el);
      return el;
    });
    const render = () => {
      cells.forEach((el, i) => {
        el.textContent = tiles[i] ? String(tiles[i]) : '';
        el.classList.toggle('gap', tiles[i] === 0);
        el.classList.toggle('home', tiles[i] !== 0 && tiles[i] === i + 1);
      });
      ctx.status(P(moves, ['move', 'moves'], ['coup', 'coups']));
    };
    /** Slide every tile between `i` and the gap (same row or column) one step. */
    const tap = (i: number) => {
      const gr = Math.floor(gap / n), gc = gap % n, r = Math.floor(i / n), c = i % n;
      if (i === gap || (gr !== r && gc !== c)) return;
      ctx.touch();
      const delta = gr === r ? (c > gc ? 1 : -1) : r > gr ? n : -n;
      while (gap !== i) {
        const nx = gap + delta;
        tiles[gap] = tiles[nx];
        tiles[nx] = 0;
        gap = nx;
        moves++;
      }
      render();
      if (solved()) ctx.solved();
    };
    const sv = ctx.saved as { tiles?: number[]; moves?: number } | undefined;
    if (sv?.tiles?.length === tiles.length && [...sv.tiles].sort((a, b) => a - b).every((t, i) => t === i)) {
      tiles.splice(0, tiles.length, ...sv.tiles);
      gap = tiles.indexOf(0);
      moves = sv.moves ?? 0;
    }
    root.append(grid);
    render();
    return {
      snapshot: () => ({ tiles, moves }),
      onKey(e) {
        const gr = Math.floor(gap / n), gc = gap % n;
        // Arrow = direction the tile moves; so the tile on the opposite side of the gap moves in.
        const m: Record<string, [number, number]> = { ArrowLeft: [0, 1], ArrowRight: [0, -1], ArrowUp: [1, 0], ArrowDown: [-1, 0] };
        const v = m[e.key];
        if (!v) return false;
        const r = gr + v[0], c = gc + v[1];
        if (r >= 0 && r < n && c >= 0 && c < n) tap(r * n + c);
        return true;
      },
    };
  },
};
