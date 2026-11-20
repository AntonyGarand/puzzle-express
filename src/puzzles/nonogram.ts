import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h } from '../core/ui';
import './nonogram.css';

const runs = (line: boolean[]) => {
  const out: number[] = [];
  let k = 0;
  for (const v of line) {
    if (v) k++;
    else if (k) {
      out.push(k);
      k = 0;
    }
  }
  if (k) out.push(k);
  return out;
};
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export const nonogram: PuzzleDef = {
  id: 'nonogram',
  get name() {
    return L('Nonogram', 'Nonogramme');
  },
  category: 'logic',
  get rules() {
    return L('Clues are runs of filled tiles. Drag to paint.', 'Les indices donnent les blocs pleins. Glissez pour peindre.');
  },
  help: () => ({
    goal: L(
      'Fill in cells so that every row and column matches its clue numbers.',
      'Remplissez des cases pour que chaque rangée et chaque colonne corresponde à ses indices.',
    ),
    steps: [
      L(
        'Each clue lists, in order, the lengths of the filled blocks in that line, with at least one empty cell between blocks. A 0 means the line is empty.',
        'Chaque indice donne, dans l’ordre, la longueur des blocs pleins de la ligne, séparés par au moins une case vide. Un 0 veut dire que la ligne est vide.',
      ),
      L(
        'Tap a cell to fill it. Tap it again to mark it ✕ (surely empty), and once more to clear it.',
        'Touchez une case pour la remplir. Retouchez-la pour la marquer d’un ✕ (vide à coup sûr), puis encore une fois pour l’effacer.',
      ),
      L(
        'Long-press (or right-click) a cell to mark it ✕ right away. Drag to repeat your first change over several cells.',
        'Appuyez longuement (ou cliquez droit) sur une case pour la marquer d’un ✕ directement. Glissez pour répéter votre premier changement sur plusieurs cases.',
      ),
      L(
        'Keyboard: arrow keys move, Space cycles a cell, X marks it, Delete clears it.',
        'Au clavier : les flèches déplacent, Espace change l’état de la case, X la marque, Suppr l’efface.',
      ),
      L(
        'A clue fades once its line matches. The puzzle is solved when every line matches.',
        'Un indice pâlit quand sa ligne correspond. La grille est résolue quand toutes les lignes correspondent.',
      ),
    ],
    tips: [
      L(
        'Start with big clues: in a line of 5, a 4 always covers the middle three cells.',
        'Commencez par les gros indices : sur une ligne de 5, un 4 couvre toujours les trois cases du milieu.',
      ),
      L('Mark cells you know are empty with ✕ so you don’t lose track.', 'Marquez d’un ✕ les cases vides pour ne pas vous perdre.'),
    ],
  }),
  par: (d) => byLevel(d, [30, 50, 90, 150, 280]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [5, 5, 7, 8, 10]);
    const density = byLevel(d, [0.66, 0.56, 0.58, 0.56, 0.56]);
    let sol: boolean[];
    do sol = Array.from({ length: n * n }, () => rng.chance(density));
    while (sol.filter(Boolean).length < n);
    const row = (g: boolean[], r: number) => g.slice(r * n, r * n + n);
    const col = (g: boolean[], c: number) => Array.from({ length: n }, (_, r) => g[r * n + c]);
    const rowClues = Array.from({ length: n }, (_, r) => runs(row(sol, r)));
    const colClues = Array.from({ length: n }, (_, c) => runs(col(sol, c)));

    // 0 empty, 1 filled, 2 marked
    const st = new Array<number>(n * n).fill(0);
    /** Keyboard cursor (-1 until the keyboard is used). */
    let cur = -1;
    let done = false;

    const wrap = h('div', { class: 'nono', style: `--cols:${n}` });
    const colEls = colClues.map((cl) => h('div', { class: 'clue col' }, ...(cl.length ? cl : [0]).map((x) => h('span', null, x))));
    const rowEls = rowClues.map((cl) => h('div', { class: 'clue row' }, ...(cl.length ? cl : [0]).map((x) => h('span', null, x))));
    const grid = board(n, n, 'nono-grid');
    const cells = st.map((_, i) => {
      const el = h('div', { class: 'cell', 'data-i': i });
      grid.append(el);
      return el;
    });
    wrap.append(h('div', { class: 'corner' }), h('div', { class: 'cols' }, ...colEls), h('div', { class: 'rows' }, ...rowEls), grid);

    const render = () => {
      const filled = st.map((v) => v === 1);
      cells.forEach((el, i) => {
        el.classList.toggle('on', st[i] === 1);
        el.classList.toggle('x', st[i] === 2);
        el.classList.toggle('cur', i === cur);
      });
      let ok = true;
      rowEls.forEach((el, r) => {
        const m = same(runs(row(filled, r)), rowClues[r]);
        el.classList.toggle('done', m);
        ok &&= m;
      });
      colEls.forEach((el, c) => {
        const m = same(runs(col(filled, c)), colClues[c]);
        el.classList.toggle('done', m);
        ok &&= m;
      });
      return ok;
    };

    // Long-press (350 ms on the first cell, before the stroke spreads) marks ✕ directly.
    let pressTimer = 0;
    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = 0;
      for (const el of cells) el.classList.remove('lp');
    };

    // Tap cycles empty → filled → ✕ → empty. Dragging repeats the first cell's change (from → to) on every
    // cell in the same starting state, so a stroke never overwrites cells of another kind.
    let stroke: { from: number; to: number; first: number; id: number; x: number; y: number; spread: boolean } | null = null;
    const set = (i: number, v: number) => {
      st[i] = v;
      if (render()) {
        done = true;
        stroke = null;
        cancelPress();
        ctx.solved();
      }
    };
    const cellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const i = el?.dataset.i;
      return el && grid.contains(el) && i != null ? Number(i) : -1;
    };
    grid.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.addEventListener('pointerdown', (e) => {
      if (done || stroke) return;
      const i = cellAt(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      ctx.touch();
      cur = -1;
      const from = st[i];
      const to = e.button === 2 ? (from === 2 ? 0 : 2) : (from + 1) % 3;
      stroke = { from, to, first: i, id: e.pointerId, x: e.clientX, y: e.clientY, spread: false };
      set(i, to);
      // Only an empty cell turned filled can still become ✕ by holding.
      if (done || to !== 1) return;
      cells[i].classList.add('lp');
      pressTimer = window.setTimeout(() => {
        pressTimer = 0;
        cells[i].classList.remove('lp');
        if (!stroke || stroke.spread || done) return;
        stroke.to = 2;
        set(i, 2);
        try {
          navigator.vibrate?.(15);
        } catch {
          /* not allowed */
        }
      }, 350);
    });
    grid.addEventListener('pointermove', (e) => {
      const g = stroke;
      if (!g || e.pointerId !== g.id) return;
      if (pressTimer && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) cancelPress();
      const i = cellAt(e.clientX, e.clientY);
      if (i < 0 || i === g.first || st[i] !== g.from) return;
      g.spread = true;
      cancelPress();
      set(i, g.to);
    });
    const end = (e: PointerEvent) => {
      if (stroke && e.pointerId !== stroke.id) return;
      cancelPress();
      stroke = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    const sv = ctx.saved as { st?: unknown; cur?: unknown } | undefined;
    if (Array.isArray(sv?.st) && sv.st.length === st.length) sv.st.forEach((v, i) => (st[i] = v === 1 || v === 2 ? v : 0));
    const c0 = sv?.cur;
    if (typeof c0 === 'number' && Number.isInteger(c0) && c0 >= -1 && c0 < st.length) cur = c0;
    root.append(wrap);
    render();

    const DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    return {
      snapshot: () => ({ st, cur }),
      onKey(e) {
        if (done) return false;
        const dir = DIRS[e.key];
        if (dir) {
          if (cur < 0) cur = 0;
          else {
            const r = Math.min(n - 1, Math.max(0, Math.floor(cur / n) + dir[1]));
            const c = Math.min(n - 1, Math.max(0, (cur % n) + dir[0]));
            cur = r * n + c;
          }
          render();
          return true;
        }
        if (cur < 0) return false;
        const next =
          e.key === ' ' || e.key === 'Enter'
            ? (st[cur] + 1) % 3
            : e.key === 'x' || e.key === 'X'
              ? st[cur] === 2
                ? 0
                : 2
              : e.key === 'Backspace' || e.key === 'Delete'
                ? 0
                : -1;
        if (next < 0) return false;
        ctx.touch();
        set(cur, next);
        return true;
      },
      destroy() {
        cancelPress();
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      },
    };
  },
};
