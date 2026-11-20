import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, s } from '../core/ui';

// Connection bits: N=1 E=2 S=4 W=8
const DIRS = [
  { bit: 1, dr: -1, dc: 0, opp: 4 },
  { bit: 2, dr: 0, dc: 1, opp: 8 },
  { bit: 4, dr: 1, dc: 0, opp: 1 },
  { bit: 8, dr: 0, dc: -1, opp: 2 },
];
const rot = (m: number, k: number) => {
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};

export const pipes: PuzzleDef = {
  id: 'pipes',
  get name() {
    return L('Pipes', 'Tuyaux');
  },
  category: 'paths',
  get rules() {
    return L('Rotate tiles until everything joins the source.', 'Tournez les tuiles pour tout relier à la source.');
  },
  help: () => ({
    goal: L(
      'Rotate the pipe tiles so every one is connected to the source in the centre, with no loose ends.',
      'Tournez les tuiles pour que chacune soit reliée à la source au centre, sans aucun bout libre.',
    ),
    steps: [
      L(
        'Tap a tile to turn it a quarter turn clockwise. Right-click turns it the other way.',
        'Touchez une tuile pour la tourner d’un quart de tour vers la droite. Le clic droit la tourne dans l’autre sens.',
      ),
      L(
        'The source is the big circle in the middle. Tiles joined to it light up.',
        'La source est le gros cercle au centre. Les tuiles qui y sont reliées s’allument.',
      ),
      L(
        'You win when every tile is lit and no pipe points at a wall or a mismatched neighbour.',
        'Vous gagnez quand toutes les tuiles sont allumées et qu’aucun tuyau ne pointe vers un mur ou un voisin mal tourné.',
      ),
      L('The grid grows from 4×4 to 8×8.', 'La grille passe de 4×4 à 8×8.'),
    ],
    tips: [
      L(
        'Start at the edges and corners: pipes there can’t point outward.',
        'Commencez par les bords et les coins : les tuyaux ne peuvent pas pointer vers l’extérieur.',
      ),
      L(
        'End pieces (small dots) have one opening; straight pieces only two useful positions.',
        'Les bouts (petits points) n’ont qu’une ouverture; les droits, seulement deux positions utiles.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [20, 40, 70, 110, 170]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [4, 5, 6, 7, 8]);
    const base = new Array<number>(n * n).fill(0);
    const src = Math.floor(n / 2) * n + Math.floor(n / 2);

    // Random spanning tree (randomised Prim on edges), avoiding 4-way crosses mostly.
    const inTree = new Array<boolean>(n * n).fill(false);
    inTree[src] = true;
    const frontier: [number, (typeof DIRS)[number]][] = [];
    const pushEdges = (i: number) => {
      const r = Math.floor(i / n),
        c = i % n;
      for (const dd of DIRS) {
        const rr = r + dd.dr,
          cc = c + dd.dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) frontier.push([i, dd]);
      }
    };
    pushEdges(src);
    let added = 1;
    while (added < n * n && frontier.length) {
      const k = rng.int(0, frontier.length - 1);
      const [i, dd] = frontier[k];
      frontier.splice(k, 1);
      const j = (Math.floor(i / n) + dd.dr) * n + (i % n) + dd.dc;
      if (inTree[j]) continue;
      const deg = [1, 2, 4, 8].filter((b) => base[i] & b).length;
      if (deg >= 3 && frontier.length > 2 && rng.chance(0.85)) {
        frontier.push([i, dd]);
        continue;
      }
      base[i] |= dd.bit;
      base[j] |= dd.opp;
      inTree[j] = true;
      added++;
      pushEdges(j);
    }

    const turns = base.map(() => 0);
    // Randomise; keep straight pieces and crosses from being trivially "already right" too often.
    do turns.forEach((_, i) => (turns[i] = rng.int(0, 3)));
    while (turns.every((t, i) => rot(base[i], t) === base[i]));

    const grid = board(n, n, 'pipes');
    const svgs: SVGSVGElement[] = [];
    const cells = base.map((m, i) => {
      const svg = s('svg', { viewBox: '0 0 100 100', class: 'pipe' });
      for (const dd of DIRS) if (m & dd.bit) svg.append(s('line', { x1: 50, y1: 50, x2: 50 + dd.dc * 50, y2: 50 + dd.dr * 50 }));
      const deg = DIRS.filter((dd) => m & dd.bit).length;
      if (i === src) svg.append(s('circle', { cx: 50, cy: 50, r: 20, class: 'src' }));
      else if (deg === 1) svg.append(s('circle', { cx: 50, cy: 50, r: 14 }));
      else svg.append(s('circle', { cx: 50, cy: 50, r: 9 }));
      svgs.push(svg);
      const el = h('button', { type: 'button', class: 'cell', onclick: () => turn(i, 1) }, svg);
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        turn(i, -1);
      });
      grid.append(el);
      return el;
    });

    const cur = (i: number) => rot(base[i], turns[i]);
    const render = () => {
      const lit = new Set<number>([src]);
      const q = [src];
      let loose = 0;
      while (q.length) {
        const i = q.shift()!;
        const r = Math.floor(i / n),
          c = i % n,
          m = cur(i);
        for (const dd of DIRS) {
          if (!(m & dd.bit)) continue;
          const rr = r + dd.dr,
            cc = c + dd.dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) {
            loose++;
            continue;
          }
          const j = rr * n + cc;
          if (!(cur(j) & dd.opp)) {
            loose++;
            continue;
          }
          if (!lit.has(j)) {
            lit.add(j);
            q.push(j);
          }
        }
      }
      cells.forEach((el, i) => el.classList.toggle('lit', lit.has(i)));
      svgs.forEach((svg, i) => (svg.style.transform = `rotate(${turns[i] * 90}deg)`));
      ctx.status(L(`${lit.size} / ${n * n} connected`, `${lit.size} / ${n * n} reliées`));
      return lit.size === n * n && loose === 0;
    };
    const turn = (i: number, k: number) => {
      ctx.touch();
      turns[i] += k;
      if (render()) ctx.solved();
    };
    const sv = ctx.saved as { turns?: number[] } | undefined;
    if (sv?.turns?.length === turns.length) sv.turns.forEach((t, i) => (turns[i] = t));
    root.append(grid);
    render();
    return { snapshot: () => ({ turns }) };
  },
};
