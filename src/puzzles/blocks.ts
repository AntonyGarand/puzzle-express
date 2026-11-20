import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, PALETTE, shake } from '../core/ui';
import { anim, baseSeed, int, isIntArr, subRng } from './movekit/kit';
import { drawPiece, fits, fitsAnywhere, fullLines, PIECES, type Piece } from './movekit/pieces';
import './blocks.css';

const colour = (p: Piece) => PALETTE[p.fam % PALETTE.length];

export const blocks: PuzzleDef = {
  id: 'blocks',
  get name() { return L('Blocks', 'Blocs'); },
  category: 'moves',
  get rules() { return L('Place the pieces. Fill rows or columns to clear them.', 'Placez les pièces. Une ligne ou colonne pleine s’efface.'); },
  help: () => ({
    goal: L(
      'Clear the target number of lines by filling complete rows or columns with pieces.',
      'Effacez le nombre de lignes demandé en remplissant des rangées ou des colonnes complètes.',
    ),
    steps: [
      L('Drag a piece from the tray onto the grid; a preview shows where it lands and which lines will clear.', 'Glissez une pièce du bac vers la grille : un aperçu montre où elle se pose et quelles lignes s’effaceront.'),
      L('Or tap a piece (or press 1, 2 or 3), then tap a cell to centre it there.', 'Ou touchez une pièce (ou appuyez sur 1, 2 ou 3), puis touchez une case pour la centrer là.'),
      L('A full row or column disappears and counts towards the goal.', 'Une rangée ou une colonne pleine disparaît et compte pour l’objectif.'),
      L('Pieces don’t rotate. When all three are placed, three new ones arrive.', 'Les pièces ne tournent pas. Une fois les trois placées, trois nouvelles arrivent.'),
      L('Faded pieces fit nowhere. If none of your pieces fit, the game is over.', 'Les pièces pâlies ne rentrent nulle part. Si aucune ne rentre, la partie est finie.'),
    ],
    tips: [
      L('Keep the board open and leave room for the big pieces.', 'Gardez la grille dégagée et laissez de la place pour les grosses pièces.'),
      L('Filling a row and a column at once clears both.', 'Remplir une rangée et une colonne d’un coup efface les deux.'),
    ],
  }),
  par: (d) => byLevel(d, [60, 110, 170, 240, 330]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [7, 8, 8, 8, 8]);
    const goal = byLevel(d, [6, 10, 14, 17, 21]);
    const maxTier = byLevel(d, [3, 4, 4, 5, 5]);
    const bigBias = byLevel(d, [0, 0.2, 0.35, 0.45, 0.6]);
    const prefill = byLevel(d, [0, 0, 3, 5, 7]);
    const base = baseSeed(rng);

    // Board: 0 empty, otherwise colour index + 1.
    let cells = new Array<number>(n * n).fill(0);
    for (let k = 0; k < prefill; k++) {
      const i = rng.int(0, n * n - 1);
      cells[i] = 9; // grey filler
      const { rows, cols } = fullLines(cells, n);
      if (rows.length || cols.length) cells[i] = 0;
    }
    let tray: number[] = [];
    let batch = 0;
    let cleared = 0;
    let sel = -1;
    let over = false;

    /** Batch k is drawn from its own sub-seeded rng; a couple of redraws avoid a dead hand when possible. */
    const deal = () => {
      const r = subRng(base, batch++);
      let hand: number[] = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        hand = [0, 1, 2].map(() => drawPiece(r, maxTier, bigBias));
        if (hand.some((p) => fitsAnywhere(cells, n, PIECES[p]))) break;
      }
      tray = hand;
    };

    const sv = ctx.saved as { cells?: unknown; tray?: unknown; batch?: unknown; cleared?: unknown; sel?: unknown } | undefined;
    if (isIntArr(sv?.cells, n * n) && isIntArr(sv?.tray, 3) && sv.tray.every((p) => p >= -1 && p < PIECES.length) && sv.tray.some((p) => p >= 0)) {
      cells = sv.cells.map((v) => Math.max(0, Math.min(9, v)));
      tray = sv.tray.slice();
      batch = int(sv.batch, 1);
      cleared = int(sv.cleared, 0);
      sel = int(sv.sel, -1);
      if (sel < 0 || sel > 2 || tray[sel] < 0) sel = -1;
    } else deal();

    const grid = board(n, n, 'blk-grid');
    const els = cells.map((_, i) => {
      const el = h('button', { type: 'button', class: 'cell', onclick: () => tapCell(i) });
      grid.append(el);
      return el;
    });
    const trayEl = h('div', { class: 'blk-tray' });
    const slots = [0, 1, 2].map((k) => {
      const el = h('button', { type: 'button', class: 'key blk-slot', onclick: () => tapSlot(k) });
      el.addEventListener('pointerdown', (e) => startDrag(k, e));
      trayEl.append(el);
      return el;
    });

    let preview: { p: Piece; r: number; c: number } | null = null;
    const render = () => {
      const pv = new Set<number>();
      const clr = new Set<number>();
      if (preview) {
        const { p, r, c } = preview;
        const tmp = cells.slice();
        for (const [dr, dc] of p.cells) { pv.add((r + dr) * n + c + dc); tmp[(r + dr) * n + c + dc] = 1; }
        const { rows, cols } = fullLines(tmp, n);
        for (const rr of rows) for (let j = 0; j < n; j++) clr.add(rr * n + j);
        for (const cc of cols) for (let j = 0; j < n; j++) clr.add(j * n + cc);
      }
      els.forEach((el, i) => {
        const v = cells[i];
        const isPv = pv.has(i);
        el.className = `cell ${v ? 'fill' : ''} ${isPv ? 'pv' : ''} ${clr.has(i) ? 'clr' : ''}`.replace(/\s+/g, ' ').trim();
        const c = v ? (v === 9 ? 'var(--muted)' : PALETTE[v - 1]) : isPv ? colour(preview!.p) : '';
        if (c) el.setAttribute('style', `--c:${c}`);
        else el.removeAttribute('style');
      });
      slots.forEach((el, k) => {
        const p = tray[k];
        el.className = `key blk-slot ${k === sel ? 'sel' : ''} ${p < 0 ? 'used' : ''}`.replace(/\s+/g, ' ').trim();
        if (p < 0) { el.replaceChildren(); return; }
        const pc = PIECES[p];
        const fitsNow = fitsAnywhere(cells, n, pc);
        el.classList.toggle('nofit', !fitsNow);
        el.replaceChildren(
          h('span', { class: 'blk-mini', style: `--w:${pc.w};--h:${pc.h}` },
            ...pc.cells.map(([r, c]) => h('i', { style: `grid-row:${r + 1};grid-column:${c + 1};--c:${colour(pc)}` }))),
        );
      });
      ctx.status(L(`Lines ${Math.min(cleared, goal)}/${goal}`, `Lignes ${Math.min(cleared, goal)}/${goal}`));
    };

    const place = (k: number, r: number, c: number): boolean => {
      const p = PIECES[tray[k]];
      if (over || !p || !fits(cells, n, p, r, c)) return false;
      ctx.touch();
      const col = (p.fam % PALETTE.length) + 1;
      const placed = p.cells.map(([dr, dc]) => (r + dr) * n + c + dc);
      for (const i of placed) cells[i] = col;
      const { rows, cols } = fullLines(cells, n);
      const gone = new Set<number>();
      for (const rr of rows) for (let j = 0; j < n; j++) gone.add(rr * n + j);
      for (const cc of cols) for (let j = 0; j < n; j++) gone.add(j * n + cc);
      gone.forEach((i) => (cells[i] = 0));
      cleared += rows.length + cols.length;
      tray[k] = -1;
      sel = -1;
      preview = null;
      if (tray.every((x) => x < 0)) deal();
      render();
      for (const i of placed) if (!gone.has(i)) anim(els[i], [{ transform: 'scale(0.8)' }, { transform: 'scale(1)' }], 140);
      gone.forEach((i) => anim(els[i], [{ background: 'var(--accent)' }, { background: 'var(--cell)' }], 320));
      if (cleared >= goal) { over = true; ctx.solved(); return true; }
      if (!tray.some((x) => x >= 0 && fitsAnywhere(cells, n, PIECES[x]))) {
        over = true;
        shake(grid);
        ctx.status(L(`No room left · ${cleared}/${goal} lines`, `Plus de place · ${cleared}/${goal} lignes`));
        ctx.failed();
      }
      return true;
    };

    let suppressClick = false;
    const tapSlot = (k: number) => {
      if (suppressClick) { suppressClick = false; return; }
      if (over || tray[k] < 0) return;
      ctx.touch();
      sel = sel === k ? -1 : k;
      render();
    };
    /** Tap on the board with a piece selected: centre the piece on the tapped cell. */
    const tapCell = (i: number) => {
      if (over || sel < 0) return;
      const p = PIECES[tray[sel]];
      const r = Math.max(0, Math.min(n - p.h, Math.floor(i / n) - Math.floor((p.h - 1) / 2)));
      const c = Math.max(0, Math.min(n - p.w, (i % n) - Math.floor((p.w - 1) / 2)));
      if (!place(sel, r, c)) shake(grid);
    };

    // Drag from the tray: a ghost follows the pointer (lifted above the finger on touch) and snaps to the grid.
    let drag: { k: number; id: number; sx: number; sy: number; active: boolean; ghost: HTMLElement | null; lift: number } | null = null;
    const geom = () => {
      const a = els[0].getBoundingClientRect(), b = els[1].getBoundingClientRect();
      return { ox: a.left, oy: a.top, cs: a.width, pitch: b.left - a.left };
    };
    const startDrag = (k: number, e: PointerEvent) => {
      if (over || tray[k] < 0 || drag) return;
      drag = { k, id: e.pointerId, sx: e.clientX, sy: e.clientY, active: false, ghost: null, lift: e.pointerType === 'touch' ? 1 : 0 };
      slots[k].setPointerCapture?.(e.pointerId);
    };
    const moveDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = PIECES[tray[drag.k]];
      const g = geom();
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.active = true;
        sel = drag.k;
        drag.ghost = h('div', { class: 'blk-ghost', style: `--cs:${g.cs}px;--gap:${g.pitch - g.cs}px;--w:${p.w};--h:${p.h}` },
          ...p.cells.map(([r, c]) => h('i', { style: `grid-row:${r + 1};grid-column:${c + 1};--c:${colour(p)}` })));
        root.append(drag.ghost);
      }
      const gw = p.w * g.pitch, gh = p.h * g.pitch;
      const gx = e.clientX - gw / 2, gy = e.clientY - gh / 2 - drag.lift * (gh / 2 + g.pitch * 1.2);
      drag.ghost!.style.left = `${gx}px`;
      drag.ghost!.style.top = `${gy}px`;
      const r = Math.round((gy - g.oy) / g.pitch), c = Math.round((gx - g.ox) / g.pitch);
      const next = fits(cells, n, p, r, c) ? { p, r, c } : null;
      if (next?.r !== preview?.r || next?.c !== preview?.c || !next !== !preview) { preview = next; render(); }
    };
    const endDrag = (e: PointerEvent, cancel = false) => {
      if (!drag || e.pointerId !== drag.id) return;
      const g = drag;
      drag = null;
      if (!g.active) return;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      g.ghost?.remove();
      const pv = preview;
      preview = null;
      if (!cancel && pv && place(g.k, pv.r, pv.c)) return;
      sel = -1;
      render();
    };
    for (const el of slots) {
      el.addEventListener('pointermove', moveDrag);
      el.addEventListener('pointerup', (e) => endDrag(e));
      el.addEventListener('pointercancel', (e) => endDrag(e, true));
    }

    root.append(grid, trayEl);
    render();
    return {
      snapshot: () => ({ cells, tray, batch, cleared, sel }),
      onKey(e) {
        const k = Number(e.key) - 1;
        if (k >= 0 && k <= 2 && e.key.length === 1) { tapSlot(k); return true; }
        if (e.key === 'Escape') { sel = -1; render(); return true; }
        return false;
      },
      destroy() { drag?.ghost?.remove(); },
    };
  },
};
