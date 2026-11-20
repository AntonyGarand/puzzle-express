import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';
import { colourRegions, edgeClasses, nb8, regionAdjacency, tint } from './logickit/kit';
import { genStars } from './logickit/starsgen';
import './stars.css';

export const stars: PuzzleDef = {
  id: 'stars',
  get name() { return L('Stars', 'Étoiles'); },
  category: 'logic',
  get rules() { return L('One star per row, column and region. Stars never touch.', 'Une étoile par rangée, colonne et région. Jamais collées.'); },
  help: () => ({
    goal: L(
      'Place exactly one star in every row, every column and every coloured region.',
      'Placez exactement une étoile dans chaque rangée, chaque colonne et chaque région colorée.',
    ),
    steps: [
      L('Each row, column and coloured region gets exactly one star.', 'Chaque rangée, colonne et région colorée reçoit une seule étoile.'),
      L('Two stars may never touch, not even at a corner.', 'Deux étoiles ne se touchent jamais, même pas en diagonale.'),
      L(
        'Tap a cell once to mark it ✕ (no star), twice for a star, a third time to clear it.',
        'Touchez une case une fois pour la marquer ✕ (pas d’étoile), deux fois pour une étoile, trois fois pour l’effacer.',
      ),
      L('Clashing stars are marked. The footer counts the stars placed.', 'Les étoiles en conflit sont signalées. Le bas de la carte compte les étoiles placées.'),
    ],
    tips: [
      L(
        'A region that fits inside one row or column owns that line’s star: cross out the rest of the line.',
        'Une région contenue dans une seule rangée ou colonne y prend l’étoile : barrez le reste de la ligne.',
      ),
      L(
        'After placing a star, cross out its 8 neighbours plus the rest of its row, column and region.',
        'Après avoir placé une étoile, barrez ses 8 voisines ainsi que le reste de sa rangée, de sa colonne et de sa région.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [35, 70, 120, 200, 300]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [5, 6, 7, 8, 9]);
    const { region } = genStars(n, rng);
    // Distinct colours while the palette lasts; otherwise neighbours differ.
    const colour = n <= 8 ? rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n) : colourRegions(n, regionAdjacency(region, n, n, n), rng.int(0, 7));
    const edges = edgeClasses(n, n, (i) => region[i]);

    // 0 empty, 1 marked ✕, 2 star
    const st = new Array<number>(n * n).fill(0);
    const grid = board(n, n, 'lk-plate');
    const cells = st.map((_, i) => {
      const el = h('button', {
        type: 'button',
        class: `cell ${edges[i]}`,
        'data-i': i,
        style: `--rc:${tint(colour[region[i]], 42)}`,
        onclick: () => tap(i),
      });
      grid.append(el);
      return el;
    });

    const render = () => {
      const starsAt = st.map((v, i) => (v === 2 ? i : -1)).filter((i) => i >= 0);
      const bad = new Set<number>();
      for (const a of starsAt) for (const b of starsAt) {
        if (a >= b) continue;
        const clash =
          Math.floor(a / n) === Math.floor(b / n) || a % n === b % n || region[a] === region[b] || nb8(a, n, n).includes(b);
        if (clash) { bad.add(a); bad.add(b); }
      }
      cells.forEach((el, i) => {
        el.classList.toggle('star', st[i] === 2);
        el.classList.toggle('x', st[i] === 1);
        el.classList.toggle('err', bad.has(i));
      });
      ctx.status(L(`${starsAt.length} / ${n} stars`, `${starsAt.length} / ${n} étoiles`));
      return starsAt.length === n && bad.size === 0;
    };

    let done = false;
    const tap = (i: number) => {
      if (done) return;
      ctx.touch();
      st[i] = (st[i] + 1) % 3;
      if (render()) { done = true; ctx.solved(); }
    };

    const sv = ctx.saved as { st?: unknown } | undefined;
    if (Array.isArray(sv?.st) && sv.st.length === st.length) sv.st.forEach((v, i) => (st[i] = v === 1 || v === 2 ? v : 0));
    root.append(grid);
    render();
    return { snapshot: () => ({ st }) };
  },
};
