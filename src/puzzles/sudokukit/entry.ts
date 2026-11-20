import './kit.css';
import { L } from '../../core/i18n';
import type { PuzzleCtx, PuzzleInstance } from '../../core/types';
import { board, h, pad } from '../../core/ui';
import { conflicts, type Problem } from './solver';

export interface EntryOpts {
  ctx: PuzzleCtx;
  cols: number;
  rows: number;
  problem: Problem;
  /** Per cell: <0 inactive (clue/block), 0 empty, >0 given digit. */
  puzzle: number[];
  /** Extra classes on the board element. */
  boardClass: string;
  /** Static extra classes per cell (borders, tints…). */
  cellClass?: (i: number) => string;
  /** Add static children to a cell (cage sums, signs, clue numbers…). Called for inactive cells too. */
  decorate?: (el: HTMLElement, i: number) => void;
}

/**
 * Shared select-a-cell + number pad + keyboard game used by the number-logic grids.
 * Validation is rule-based through `conflicts()`; snapshot is `{ vals, sel }`.
 */
export function entryGame(o: EntryOpts): PuzzleInstance {
  const { ctx, cols, rows, problem, puzzle } = o;
  const N = problem.maxDigit;
  const size = cols * rows;
  const active = (i: number) => puzzle[i] >= 0;
  const given = puzzle.map((v) => v > 0);
  const vals = [...puzzle];
  let sel = puzzle.findIndex((v) => v === 0);
  let done = false;

  const unitsOf: number[][] = Array.from({ length: size }, () => []);
  problem.units.forEach((u, k) => u.cells.forEach((c) => unitsOf[c].push(k)));
  const peerOf = (i: number, j: number) => unitsOf[i].some((k) => problem.units[k].cells.includes(j));

  const grid = board(cols, rows, `numgrid ${o.boardClass}`);
  const valEls: HTMLElement[] = [];
  const baseCls: string[] = [];
  const cells = puzzle.map((_, i) => {
    const lastC = i % cols === cols - 1 ? ' lc' : '', lastR = Math.floor(i / cols) === rows - 1 ? ' lr' : '';
    const extra = (o.cellClass?.(i) ?? '') + lastC + lastR;
    let el: HTMLElement;
    if (active(i)) {
      baseCls[i] = `cell${given[i] ? ' given' : ''} ${extra}`.replace(/\s+/g, ' ').trim();
      el = h('button', { type: 'button', class: baseCls[i], onclick: () => select(i) });
      valEls[i] = h('span', { class: 'v' });
      el.append(valEls[i]);
    } else {
      el = h('div', { class: `cell off ${extra}`.replace(/\s+/g, ' ').trim() });
    }
    o.decorate?.(el, i);
    grid.append(el);
    return el;
  });

  const render = () => {
    const bad = conflicts(problem, vals);
    const sv = sel >= 0 ? vals[sel] : 0;
    cells.forEach((el, i) => {
      if (!active(i)) return;
      valEls[i].textContent = vals[i] > 0 ? String(vals[i]) : '';
      let cls = baseCls[i];
      if (i === sel) cls += ' sel';
      if (sel >= 0 && i !== sel && peerOf(sel, i)) cls += ' peer';
      if (sv > 0 && vals[i] === sv && i !== sel) cls += ' same';
      if (bad.has(i) && !given[i]) cls += ' err';
      if (el.className !== cls) el.className = cls;
    });
    return bad;
  };

  const select = (i: number) => {
    sel = i;
    render();
  };

  const input = (v: number) => {
    if (done || sel < 0 || given[sel]) return;
    ctx.touch();
    const was = vals[sel];
    vals[sel] = vals[sel] === v ? 0 : v;
    const bad = render();
    if (vals[sel] && vals[sel] !== was && bad.has(sel)) ctx.mistake();
    if (bad.size === 0 && vals.every((x, i) => !active(i) || x > 0)) {
      done = true;
      ctx.solved();
    }
  };

  const keys = Array.from({ length: N }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
  keys.push({ label: '⌫', value: '0' });

  const saved = ctx.saved as { vals?: unknown[]; sel?: unknown } | undefined;
  if (Array.isArray(saved?.vals) && saved.vals.length === size) {
    saved.vals.forEach((v, i) => {
      if (puzzle[i] === 0 && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= N) vals[i] = v as number;
    });
  }
  if (typeof saved?.sel === 'number' && (saved.sel === -1 || (saved.sel >= 0 && saved.sel < size && active(saved.sel)))) sel = saved.sel;

  ctx.root.append(grid, pad(keys, (v) => (v === '0' ? sel >= 0 && vals[sel] > 0 && input(vals[sel]) : input(Number(v)))));
  render();

  const step = (dr: number, dc: number) => {
    let r = sel < 0 ? 0 : Math.floor(sel / cols), c = sel < 0 ? 0 : sel % cols;
    if (sel < 0 && active(0)) return select(0);
    for (;;) {
      r += dr; c += dc;
      if (r < 0 || c < 0 || r >= rows || c >= cols) return;
      if (active(r * cols + c)) return select(r * cols + c);
    }
  };

  return {
    snapshot: () => ({ vals, sel }),
    onKey(e) {
      const k = Number(e.key);
      if (k >= 1 && k <= N) { input(k); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (sel >= 0 && vals[sel] > 0) input(vals[sel]);
        return true;
      }
      const mv: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (mv[e.key]) { step(...mv[e.key]); return true; }
      return false;
    },
  };
}

/** Tutorial steps describing the shared entry controls (tap + pad, keyboard, conflict marks). */
export function entryHelpSteps(): string[] {
  return [
    L(
      'Tap a cell, then a number on the pad. Tap the same number again, or ⌫, to erase it.',
      'Touchez une case, puis un chiffre du pavé. Touchez le même chiffre, ou ⌫, pour l’effacer.',
    ),
    L(
      'Keyboard: arrow keys move, digits fill, Backspace erases. Clashing numbers are marked.',
      'Au clavier : flèches pour bouger, chiffres pour remplir, Retour arrière pour effacer. Les conflits sont signalés.',
    ),
  ];
}

/** Right/bottom thick-edge classes for a region map (`er` / `eb`), skipping the outer frame. */
export function edgeClasses(region: number[], cols: number, rows: number, i: number): string {
  const r = Math.floor(i / cols), c = i % cols;
  const out: string[] = [];
  if (c < cols - 1 && region[i] !== region[i + 1]) out.push('er');
  if (r < rows - 1 && region[i] !== region[i + cols]) out.push('eb');
  return out.join(' ');
}
