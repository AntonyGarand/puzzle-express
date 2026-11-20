import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h } from '../core/ui';

const runs = (line: boolean[]) => {
  const out: number[] = [];
  let k = 0;
  for (const v of line) {
    if (v) k++;
    else if (k) { out.push(k); k = 0; }
  }
  if (k) out.push(k);
  return out;
};
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export const nonogram: PuzzleDef = {
  id: 'nonogram',
  get name() { return L('Nonogram', 'Nonogramme'); },
  category: 'logic',
  get rules() { return L('Clues are runs of filled tiles. Drag to paint.', 'Les indices donnent les blocs pleins. Glissez pour peindre.'); },
  help: () => ({
    goal: L(
      'Fill in cells so that every row and column matches its clue numbers.',
      'Remplissez des cases pour que chaque rangée et chaque colonne corresponde à ses indices.',
    ),
    steps: [
      L('Each clue lists, in order, the lengths of the filled blocks in that line, with at least one empty cell between blocks. A 0 means the line is empty.', 'Chaque indice donne, dans l’ordre, la longueur des blocs pleins de la ligne, séparés par au moins une case vide. Un 0 veut dire que la ligne est vide.'),
      L('Tap a cell to fill it, and tap it again to clear it. Drag to paint several cells at once.', 'Touchez une case pour la remplir, et retouchez-la pour l’effacer. Glissez pour peindre plusieurs cases d’un coup.'),
      L('Switch the footer button to Mark ✕ to note cells you know are empty. Right-click also marks; X or Space switches mode.', 'Passez le bouton du bas à Marquer ✕ pour noter les cases que vous savez vides. Le clic droit marque aussi; X ou Espace change de mode.'),
      L('A clue fades once its line matches. The puzzle is solved when every line matches.', 'Un indice pâlit quand sa ligne correspond. La grille est résolue quand toutes les lignes correspondent.'),
    ],
    tips: [
      L('Start with big clues: in a line of 5, a 4 always covers the middle three cells.', 'Commencez par les gros indices : sur une ligne de 5, un 4 couvre toujours les trois cases du milieu.'),
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
    let mode: 1 | 2 = 1;

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
      });
      let ok = true;
      rowEls.forEach((el, r) => { const m = same(runs(row(filled, r)), rowClues[r]); el.classList.toggle('done', m); ok &&= m; });
      colEls.forEach((el, c) => { const m = same(runs(col(filled, c)), colClues[c]); el.classList.toggle('done', m); ok &&= m; });
      return ok;
    };

    // Drag painting: first cell decides whether we're setting or clearing.
    let paint: number | null = null;
    const cellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const i = el?.dataset.i;
      return el && grid.contains(el) && i != null ? Number(i) : -1;
    };
    const applyAt = (i: number) => {
      if (i < 0 || paint == null) return;
      if (st[i] === paint) return;
      if (paint !== 0 && st[i] !== 0) return; // don't overwrite the other kind while dragging
      st[i] = paint;
      if (render()) { paint = null; ctx.solved(); }
    };
    grid.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.addEventListener('pointerdown', (e) => {
      const i = cellAt(e.clientX, e.clientY);
      if (i < 0) return;
      ctx.touch();
      const m = e.button === 2 ? 2 : mode;
      paint = st[i] === m ? 0 : m;
      applyAt(i);
      e.preventDefault();
    });
    grid.addEventListener('pointermove', (e) => { if (paint != null) applyAt(cellAt(e.clientX, e.clientY)); });
    const end = () => (paint = null);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    const modeBtn = btn(L('Fill ■', 'Remplir ■'), () => {
      mode = mode === 1 ? 2 : 1;
      modeBtn.textContent = mode === 1 ? L('Fill ■', 'Remplir ■') : L('Mark ✕', 'Marquer ✕');
    }, 'ghost');
    ctx.controls(modeBtn);
    const sv = ctx.saved as { st?: number[] } | undefined;
    if (sv?.st?.length === st.length) sv.st.forEach((v, i) => (st[i] = v));
    root.append(wrap);
    render();
    return {
      snapshot: () => ({ st }),
      onKey(e) {
        if (e.key === 'x' || e.key === ' ') { modeBtn.click(); return true; }
        return false;
      },
      destroy() {
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      },
    };
  },
};
