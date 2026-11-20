import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, s } from '../core/ui';
import { adjacent, capture, cellAt, stepsToward } from './pathkit/grid';
import { genTracks } from './pathkit/tracks-gen';
import './tracks.css';

export const tracks: PuzzleDef = {
  id: 'tracks',
  get name() {
    return L('Tracks', 'Tracé');
  },
  category: 'paths',
  get rules() {
    return L('Draw A to B. Edge numbers count path cells per line.', 'Tracez de A à B. Les chiffres comptent les cases par ligne.');
  },
  help: () => ({
    goal: L(
      'Draw one track from A to B. The numbers around the grid say how many track cells each row and column must hold.',
      'Tracez un seul chemin de A à B. Les chiffres autour de la grille indiquent combien de cases du tracé compte chaque rangée et chaque colonne.',
    ),
    steps: [
      L(
        'Drag from A (or from the end of your track) through neighbouring cells to lay track.',
        'Glissez à partir de A (ou du bout de votre tracé) de case voisine en case voisine.',
      ),
      L(
        'The track can’t cross itself or branch, and it stops once it reaches B.',
        'Le tracé ne peut ni se croiser ni bifurquer, et il s’arrête en atteignant B.',
      ),
      L('Cells with a small square must be on the track.', 'Les cases marquées d’un petit carré doivent faire partie du tracé.'),
      L(
        'A number fades when its line is right and turns red when it has too many cells.',
        'Un chiffre pâlit quand sa ligne est juste et devient rouge si elle a trop de cases.',
      ),
      L(
        'Tap a cell on your track to cut it back there. Clear restarts from A.',
        'Touchez une case du tracé pour le couper à cet endroit. Effacer repart de A.',
      ),
    ],
    tips: [
      L(
        'A 0 means the track never enters that line; a number equal to the grid size means the whole line is used.',
        'Un 0 veut dire que le tracé n’entre jamais dans cette ligne; un chiffre égal à la taille de la grille, qu’elle est remplie au complet.',
      ),
      L(
        'Plan how to pass through the marked cells before you start drawing.',
        'Prévoyez comment passer par les cases marquées avant de tracer.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [35, 60, 90, 140, 210]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const P = genTracks(rng, d);
    const { n, a, b, exitSide } = P;
    const N = n * n;
    const given = new Set(P.givens);
    const trail: number[] = [a];

    const colEls = P.colCounts.map((v) => h('div', { class: 'clue' }, v));
    const rowEls = P.rowCounts.map((v) => h('div', { class: 'clue' }, v));
    const grid = board(n, n, 'tracks-grid');
    const cells = Array.from({ length: N }, (_, i) => {
      const el = h('div', { class: 'cell', 'data-i': i }, i === a ? 'A' : i === b ? 'B' : '');
      grid.append(el);
      return el;
    });
    const svg = s('svg', { class: 'tracks-line', viewBox: `0 0 ${n} ${n}`, 'aria-hidden': 'true' });
    const under = s('polyline', { class: 'under' });
    const over = s('polyline', { class: 'over' });
    svg.append(under, over);
    grid.append(svg);
    const wrap = h(
      'div',
      { class: 'tracks-wrap', style: `--cols:${n}` },
      h('div', { class: 'corner' }),
      h('div', { class: 'cols' }, ...colEls),
      h('div', { class: 'rows' }, ...rowEls),
      grid,
    );

    const xy = (i: number) => [(i % n) + 0.5, Math.floor(i / n) + 0.5];
    let finished = false;
    const render = () => {
      const on = new Set(trail);
      cells.forEach((el, i) => {
        el.className = `cell${on.has(i) ? ' on' : ''}${given.has(i) ? ' given' : ''}${i === a || i === b ? ' end' : ''}`;
      });
      const rc = new Array<number>(n).fill(0),
        cc = new Array<number>(n).fill(0);
      for (const i of trail) {
        rc[Math.floor(i / n)]++;
        cc[i % n]++;
      }
      let ok = true;
      const mark = (el: HTMLElement, have: number, want: number) => {
        el.classList.toggle('done', have === want);
        el.classList.toggle('over', have > want);
        ok &&= have === want;
      };
      rowEls.forEach((el, r) => mark(el, rc[r], P.rowCounts[r]));
      colEls.forEach((el, c) => mark(el, cc[c], P.colCounts[c]));
      const ptsList = trail.map(xy);
      ptsList.unshift([0, Math.floor(a / n) + 0.5]);
      const atB = trail[trail.length - 1] === b;
      if (atB) ptsList.push(exitSide === 'bottom' ? [(b % n) + 0.5, n] : [n, Math.floor(b / n) + 0.5]);
      const str = ptsList.map((p) => p.join(',')).join(' ');
      under.setAttribute('points', str);
      over.setAttribute('points', str);
      const missing = P.givens.filter((g) => !on.has(g)).length;
      const len = trail.length;
      ctx.status(
        atB
          ? ok && !missing
            ? L('Done!', 'Terminé!')
            : missing
              ? L(
                  `${missing} marked cell${missing > 1 ? 's' : ''} missed`,
                  missing > 1 ? `${missing} cases marquées oubliées` : '1 case marquée oubliée',
                )
              : L('Counts don’t match', 'Les chiffres ne collent pas')
          : L(`${len} cells`, `${len} case${len > 1 ? 's' : ''}`),
      );
      return atB && ok && !missing;
    };
    const check = () => {
      if (render() && !finished) {
        finished = true;
        drawing = false;
        ctx.solved();
      }
    };

    // ---- drawing (a trail that always starts at A) ----
    let drawing = false;
    const tryAdd = (j: number) => {
      const last = trail[trail.length - 1];
      if (last === b || trail.includes(j) || !adjacent(last, j, n)) return false;
      trail.push(j);
      return true;
    };
    const dragTo = (j: number) => {
      if (!drawing || j < 0) return;
      for (let guard = 0; guard < N; guard++) {
        const last = trail[trail.length - 1];
        if (j === last) break;
        const at = trail.indexOf(j);
        if (at >= 0) {
          trail.length = at + 1;
          break;
        }
        if (!stepsToward(last, j, n).some(tryAdd)) break;
      }
      check();
    };
    grid.addEventListener('pointerdown', (e) => {
      if (finished) return;
      const i = cellAt(grid, n, n, e.clientX, e.clientY);
      if (i < 0) return;
      const at = trail.indexOf(i);
      if (at >= 0) trail.length = at + 1;
      else if (!adjacent(trail[trail.length - 1], i, n)) return;
      ctx.touch();
      drawing = true;
      capture(grid, e.pointerId);
      e.preventDefault();
      dragTo(i);
      check();
    });
    grid.addEventListener('pointermove', (e) => dragTo(cellAt(grid, n, n, e.clientX, e.clientY)));
    const end = () => (drawing = false);
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);

    ctx.controls(
      btn(
        L('Clear', 'Effacer'),
        () => {
          if (finished) return;
          trail.length = 1;
          render();
        },
        'ghost',
      ),
    );

    const sv = ctx.saved as { trail?: unknown } | undefined;
    if (Array.isArray(sv?.trail) && sv.trail[0] === a) {
      const t = sv.trail as number[];
      const seen = new Set<number>();
      const ok = t.every(
        (v, i) =>
          Number.isInteger(v) &&
          v >= 0 &&
          v < N &&
          !seen.has(v) &&
          (seen.add(v), i === 0 || adjacent(t[i - 1], v, n)) &&
          (v !== b || i === t.length - 1),
      );
      if (ok) trail.splice(0, trail.length, ...t);
    }
    root.append(wrap);
    render();
    return { snapshot: () => ({ trail }) };
  },
};
