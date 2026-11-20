import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h, PALETTE, shake } from '../core/ui';
import { genArrange, rotated, type Shape } from './pathkit/arrange-gen';
import { innerRect } from './pathkit/grid';
import './arrange.css';

type Drag = {
  p: number;
  dr: number;
  dc: number;
  from: [number, number] | null;
  sx: number;
  sy: number;
  moved: boolean;
  ghost?: HTMLElement;
};

export const arrange: PuzzleDef = {
  id: 'arrange',
  get name() {
    return L('Arrange', 'Assembler');
  },
  category: 'moves',
  get rules() {
    return L('Drag every piece onto the board to fill it exactly.', 'Glissez les pièces pour remplir toute la grille.');
  },
  help: () => ({
    goal: L(
      'Fit every piece into the board so that it is filled exactly, with no gaps and no overlaps.',
      'Placez toutes les pièces dans la grille pour la remplir exactement, sans trou ni chevauchement.',
    ),
    steps: [
      L(
        'Drag a piece from the tray onto the board; a dashed outline shows where it will land.',
        'Glissez une pièce du bac vers la grille : un contour pointillé montre où elle se posera.',
      ),
      L('Drop it where it doesn’t fit and it goes back where it came from.', 'Si elle ne rentre pas, elle retourne d’où elle vient.'),
      L(
        'Drag a placed piece to move it. Tap it, or drag it off the board, to send it back to the tray.',
        'Glissez une pièce placée pour la déplacer. Touchez-la, ou sortez-la de la grille, pour la renvoyer au bac.',
      ),
      L(
        'From Hard up, pieces can turn: tap a piece in the tray to rotate it a quarter turn.',
        'À partir de Difficile, les pièces tournent : touchez une pièce du bac pour lui faire faire un quart de tour.',
      ),
      L('Clear sends every piece back to the tray.', 'Vider renvoie toutes les pièces au bac.'),
    ],
    tips: [
      L(
        'Place the biggest, most awkward pieces first, starting with the corners.',
        'Placez d’abord les pièces les plus grosses et les plus biscornues, en commençant par les coins.',
      ),
      L(
        'If a gap is smaller than every piece left, something has to move.',
        'Si un trou est plus petit que toutes les pièces restantes, il faut déplacer quelque chose.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [25, 45, 75, 110, 170]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const P = genArrange(rng, d);
    const { rows, cols, pieces } = P;
    const K = pieces.length;
    const N = rows * cols;
    const rot = pieces.map(() => (P.rotate ? rng.int(0, 3) : 0));
    const place: ([number, number] | null)[] = pieces.map(() => null);
    const order = rng.shuffle(pieces.map((_, i) => i));
    const shapeOf = (p: number): Shape => rotated(pieces[p].shape, rot[p]);

    const owner = new Int16Array(N);
    const recompute = () => {
      owner.fill(-1);
      place.forEach((o, p) => o && shapeOf(p).forEach(([r, c]) => (owner[(o[0] + r) * cols + o[1] + c] = p)));
    };
    const fits = (p: number, r0: number, c0: number) =>
      shapeOf(p).every(([r, c]) => {
        const rr = r0 + r,
          cc = c0 + c;
        return rr >= 0 && rr < rows && cc >= 0 && cc < cols && owner[rr * cols + cc] < 0;
      });

    // ---- DOM ----
    const grid = board(cols, rows, 'arrange-grid');
    const cells = Array.from({ length: N }, () => {
      const el = h('div', { class: 'cell' });
      grid.append(el);
      return el;
    });
    const tray = h('div', { class: 'arrange-tray', style: `--bc:${Math.max(rows, cols)}` });
    const fillMini = (el: HTMLElement, sh: Shape) => {
      const hgt = Math.max(...sh.map((q) => q[0])) + 1,
        wid = Math.max(...sh.map((q) => q[1])) + 1;
      el.style.setProperty('--pr', String(hgt));
      el.style.setProperty('--pc', String(wid));
      el.replaceChildren(...sh.map(([r, c]) => h('i', { style: `grid-row:${r + 1};grid-column:${c + 1}` })));
    };
    const trayEls = pieces.map((pc, p) => {
      const el = h('button', { type: 'button', class: 'arr-piece', style: `--c:${PALETTE[pc.colour]}`, 'data-p': p });
      el.addEventListener('click', () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (finished) return;
        if (!P.rotate) {
          shake(el);
          return;
        }
        ctx.touch();
        rot[p] = (rot[p] + 1) % 4;
        render();
      });
      return el;
    });
    order.forEach((p) => tray.append(trayEls[p]));

    let finished = false;
    let suppressClick = false;
    let preview: number[] = [];
    const render = () => {
      recompute();
      const pv = new Set(preview);
      cells.forEach((el, i) => {
        const p = owner[i];
        let cls = 'cell';
        if (p >= 0) {
          const r = Math.floor(i / cols),
            c = i % cols;
          const diff = (rr: number, cc: number) => rr < 0 || rr >= rows || cc < 0 || cc >= cols || owner[rr * cols + cc] !== p;
          cls += ' on';
          if (diff(r - 1, c)) cls += ' et';
          if (diff(r, c + 1)) cls += ' er';
          if (diff(r + 1, c)) cls += ' eb';
          if (diff(r, c - 1)) cls += ' el';
          el.setAttribute('style', `--c:${PALETTE[pieces[p].colour]}`);
        } else el.removeAttribute('style');
        if (pv.has(i)) cls += ' hint';
        el.className = cls;
      });
      trayEls.forEach((el, p) => {
        fillMini(el, shapeOf(p));
        el.hidden = !!place[p];
        el.classList.toggle('lifted', drag?.p === p && drag.moved);
      });
      const n = place.filter(Boolean).length;
      ctx.status(
        L(`${n}/${K} placed${P.rotate ? ' · tap to turn' : ''}`, P.rotate ? `${n}/${K} · touchez pour tourner` : `${n}/${K} placées`),
      );
      return n === K;
    };

    // ---- dragging ----
    let drag: Drag | null = null;
    const boardCell = (x: number, y: number) => {
      const r = innerRect(grid);
      const cs = r.width / cols;
      return { R: Math.floor((y - r.top) / cs), C: Math.floor((x - r.left) / cs), cs };
    };
    const ghostAt = (x: number, y: number) => {
      if (!drag?.ghost) return;
      const { cs } = boardCell(x, y);
      drag.ghost.style.left = `${x - (drag.dc + 0.5) * cs}px`;
      drag.ghost.style.top = `${y - (drag.dr + 0.5) * cs}px`;
    };
    const target = (x: number, y: number) => {
      if (!drag) return null;
      const { R, C } = boardCell(x, y);
      const r0 = R - drag.dr,
        c0 = C - drag.dc;
      return fits(drag.p, r0, c0) ? ([r0, c0] as [number, number]) : null;
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        ctx.touch();
        place[drag.p] = null;
        const { cs } = boardCell(e.clientX, e.clientY);
        const ghost = h('div', { class: 'arr-ghost', style: `--c:${PALETTE[pieces[drag.p].colour]};--cs:${cs}px` });
        fillMini(ghost, shapeOf(drag.p));
        drag.ghost = ghost;
        root.append(ghost);
      }
      ghostAt(e.clientX, e.clientY);
      const t = target(e.clientX, e.clientY);
      preview = t ? shapeOf(drag.p).map(([r, c]) => (t[0] + r) * cols + t[1] + c) : [];
      render();
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const dg = drag;
      if (!dg) return;
      drag = null;
      preview = [];
      if (dg.moved) {
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 0);
        dg.ghost?.remove();
        const t = e.type === 'pointerup' ? (recompute(), dragTarget(dg, e.clientX, e.clientY)) : null;
        if (t) place[dg.p] = t;
        else {
          const { R, C } = boardCell(e.clientX, e.clientY);
          const onBoard = R >= 0 && R < rows && C >= 0 && C < cols;
          place[dg.p] = onBoard ? dg.from : null; // bad spot on the board: put it back; off the board: to the tray
        }
      } else if (dg.from) {
        // tap on a placed piece: send it back to the tray
        ctx.touch();
        place[dg.p] = null;
      }
      if (render() && !finished) {
        finished = true;
        ctx.solved();
      }
    };
    const dragTarget = (dg: Drag, x: number, y: number) => {
      const prev = drag;
      drag = dg;
      const t = target(x, y);
      drag = prev;
      return t;
    };
    const begin = (e: PointerEvent, dg: Drag) => {
      if (finished) return;
      drag = dg;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      e.preventDefault();
    };
    tray.addEventListener('pointerdown', (e) => {
      const el = (e.target as Element | null)?.closest?.('.arr-piece') as HTMLElement | null;
      if (!el || e.button > 0) return;
      const p = Number(el.dataset.p);
      const sh = shapeOf(p);
      const rc = innerRect(el);
      const hgt = Math.max(...sh.map((q) => q[0])) + 1,
        wid = Math.max(...sh.map((q) => q[1])) + 1;
      const fr = Math.min(hgt - 1, Math.max(0, Math.floor(((e.clientY - rc.top) / (rc.height || 1)) * hgt)));
      const fc = Math.min(wid - 1, Math.max(0, Math.floor(((e.clientX - rc.left) / (rc.width || 1)) * wid)));
      // grab the nearest real cell of the piece
      const [dr, dc] = sh.reduce(
        (b, q) => (Math.abs(q[0] - fr) + Math.abs(q[1] - fc) < Math.abs(b[0] - fr) + Math.abs(b[1] - fc) ? q : b),
        sh[0],
      );
      begin(e, { p, dr, dc, from: null, sx: e.clientX, sy: e.clientY, moved: false });
    });
    grid.addEventListener('pointerdown', (e) => {
      const { R, C } = boardCell(e.clientX, e.clientY);
      if (R < 0 || R >= rows || C < 0 || C >= cols) return;
      const p = owner[R * cols + C];
      if (p < 0 || !place[p]) return;
      const [r0, c0] = place[p]!;
      begin(e, { p, dr: R - r0, dc: C - c0, from: [r0, c0], sx: e.clientX, sy: e.clientY, moved: false });
    });

    ctx.controls(
      btn(
        L('Clear', 'Vider'),
        () => {
          if (finished) return;
          place.fill(null);
          render();
        },
        'ghost',
      ),
    );

    // ---- resume ----
    const sv = ctx.saved as { rot?: unknown; place?: unknown } | undefined;
    if (Array.isArray(sv?.rot) && sv.rot.length === K && sv.rot.every((v) => v === 0 || v === 1 || v === 2 || v === 3)) {
      (sv.rot as number[]).forEach((v, p) => (rot[p] = P.rotate ? v : 0));
    }
    if (Array.isArray(sv?.place) && sv.place.length === K) {
      (sv.place as unknown[]).forEach((o, p) => {
        recompute();
        if (Array.isArray(o) && o.length === 2 && o.every(Number.isInteger) && fits(p, o[0], o[1])) place[p] = [o[0], o[1]];
      });
      recompute();
      if (place.every(Boolean)) place[K - 1] = null; // never resume already solved
    }
    root.append(grid, tray);
    render();
    return {
      snapshot: () => ({ rot, place }),
      destroy() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        drag?.ghost?.remove();
      },
    };
  },
};
