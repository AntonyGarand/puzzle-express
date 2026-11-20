import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, PALETTE, s } from '../core/ui';
import { genConnect } from './pathkit/connect-gen';
import { adjacent, capture, cellAt, pts, stepsToward } from './pathkit/grid';
import './connect.css';

export const connect: PuzzleDef = {
  id: 'connect',
  get name() {
    return L('Connect', 'Relier');
  },
  category: 'paths',
  get rules() {
    return L('Link same-colour dots. Fill every cell, no crossing.', 'Reliez les points de même couleur. Remplissez tout.');
  },
  help: () => ({
    goal: L(
      'Join each pair of same-colour dots with a path, and fill every cell of the grid. Paths can’t cross.',
      'Reliez chaque paire de points de même couleur par un chemin et remplissez toutes les cases. Les chemins ne se croisent pas.',
    ),
    steps: [
      L(
        'Drag from a dot to draw a path; it follows your finger from cell to cell.',
        'Glissez à partir d’un point pour tracer un chemin : il suit votre doigt de case en case.',
      ),
      L('Reach the other dot of the same colour to link the pair.', 'Rejoignez l’autre point de la même couleur pour relier la paire.'),
      L(
        'Drag back along a path to shorten it, or grab it in the middle to redraw from there.',
        'Revenez sur un chemin pour le raccourcir, ou reprenez-le au milieu pour le retracer à partir de là.',
      ),
      L('Drawing over another colour cuts that path.', 'Tracer par-dessus une autre couleur coupe ce chemin.'),
      L('Clear erases every path.', 'Effacer supprime tous les chemins.'),
    ],
    tips: [
      L(
        'Start with dots on the edges or close together; paths along the walls rarely get in the way.',
        'Commencez par les points en bordure ou proches l’un de l’autre : les chemins le long des bords gênent rarement.',
      ),
      L(
        'Every cell must be used, so let long paths wind through empty areas.',
        'Toutes les cases doivent servir : faites serpenter les longs chemins dans les zones vides.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [30, 50, 80, 120, 180]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const { n, paths: sol } = genConnect(rng, d);
    const N = n * n;
    const k = sol.length;
    const dot = new Int8Array(N).fill(-1);
    sol.forEach((p, c) => {
      dot[p[0]] = c;
      dot[p[p.length - 1]] = c;
    });

    const paths: number[][] = sol.map(() => []);
    const owner = new Int8Array(N);
    const recompute = () => {
      owner.fill(-1);
      paths.forEach((p, c) => p.forEach((i) => (owner[i] = c)));
    };
    const complete = (c: number) => {
      const p = paths[c];
      return p.length > 1 && dot[p[0]] === c && dot[p[p.length - 1]] === c && p[0] !== p[p.length - 1];
    };

    const grid = board(n, n, 'connect-grid');
    const cells = Array.from({ length: N }, (_, i) => {
      const el = h('div', { class: 'cell', 'data-i': i });
      grid.append(el);
      return el;
    });
    const svg = s('svg', { class: 'connect-lines', viewBox: `0 0 ${n} ${n}`, 'aria-hidden': 'true' });
    const lines = sol.map((_, c) => s('polyline', { style: `stroke:${PALETTE[c]}` }));
    svg.append(...lines);
    sol.forEach((p, c) => {
      for (const i of [p[0], p[p.length - 1]]) {
        svg.append(s('circle', { cx: (i % n) + 0.5, cy: Math.floor(i / n) + 0.5, r: 0.3, style: `fill:${PALETTE[c]}` }));
      }
    });
    grid.append(svg);

    let finished = false;
    const render = () => {
      recompute();
      let filled = 0;
      cells.forEach((el, i) => {
        const c = owner[i] >= 0 ? owner[i] : dot[i];
        el.className = `cell${owner[i] >= 0 ? ' on' : ''}${dot[i] >= 0 ? ' dot' : ''}`;
        if (c >= 0) el.setAttribute('style', `--c:${PALETTE[c]}`);
        else el.removeAttribute('style');
        if (owner[i] >= 0) filled++;
      });
      lines.forEach((l, c) => l.setAttribute('points', pts(paths[c], n)));
      const linked = paths.filter((_, c) => complete(c)).length;
      const pct = Math.round((filled / N) * 100);
      ctx.status(L(`${linked}/${k} linked · ${pct}% filled`, `${linked}/${k} reliées · ${pct} % rempli`));
      return linked === k && filled === N;
    };
    const check = () => {
      if (render() && !finished) {
        finished = true;
        active = -1;
        ctx.solved();
      }
    };

    // ---- drawing ----
    let active = -1;
    const tryAdd = (c: number, j: number): boolean => {
      const p = paths[c];
      if (complete(c)) return false;
      if (dot[j] >= 0 && dot[j] !== c) return false;
      if (!adjacent(p[p.length - 1], j, n)) return false;
      const o = owner[j];
      if (o >= 0 && o !== c) {
        // cut the other colour's path just before this cell
        paths[o].length = paths[o].indexOf(j);
      }
      p.push(j);
      owner[j] = c;
      return true;
    };
    const dragTo = (j: number) => {
      if (active < 0 || j < 0) return;
      const p = paths[active];
      for (let guard = 0; guard < N; guard++) {
        const last = p[p.length - 1];
        if (j === last) break;
        const at = p.indexOf(j);
        if (at >= 0) {
          p.length = at + 1; // retract
          recompute();
          break;
        }
        if (!stepsToward(last, j, n).some((x) => tryAdd(active, x))) break;
        recompute();
      }
      check();
    };
    const start = (i: number) => {
      if (finished || i < 0) return false;
      if (dot[i] >= 0) {
        const c = dot[i];
        paths[c] = [i];
        active = c;
      } else if (owner[i] >= 0) {
        const c = owner[i];
        paths[c].length = paths[c].indexOf(i) + 1;
        active = c;
      } else return false;
      ctx.touch();
      check();
      return true;
    };
    grid.addEventListener('pointerdown', (e) => {
      if (start(cellAt(grid, n, n, e.clientX, e.clientY))) {
        capture(grid, e.pointerId);
        e.preventDefault();
      }
    });
    grid.addEventListener('pointermove', (e) => {
      if (active >= 0) dragTo(cellAt(grid, n, n, e.clientX, e.clientY));
    });
    const end = () => {
      active = -1;
    };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);

    ctx.controls(
      btn(
        L('Clear', 'Effacer'),
        () => {
          if (finished) return;
          paths.forEach((p) => (p.length = 0));
          render();
        },
        'ghost',
      ),
    );

    // ---- resume ----
    const sv = ctx.saved as { paths?: unknown } | undefined;
    if (Array.isArray(sv?.paths) && sv.paths.length === k) {
      const used = new Set<number>();
      sv.paths.forEach((p, c) => {
        if (!Array.isArray(p) || !p.length || dot[p[0]] !== c) return;
        const ok = p.every(
          (v, i) =>
            Number.isInteger(v) &&
            v >= 0 &&
            v < N &&
            !used.has(v) &&
            (i === 0 || adjacent(p[i - 1], v, n)) &&
            (i === 0 || dot[v] < 0 || (dot[v] === c && i === p.length - 1)),
        );
        if (!ok) return;
        p.forEach((v: number) => used.add(v));
        paths[c] = [...p];
      });
    }
    root.append(grid);
    render();

    return {
      snapshot: () => ({ paths }),
    };
  },
};
