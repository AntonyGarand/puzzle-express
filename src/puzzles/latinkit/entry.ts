import './kit.css';
import { L, P } from '../../core/i18n';
import type { PuzzleCtx, PuzzleInstance } from '../../core/types';
import { board, h, pad } from '../../core/ui';

export interface LatinEntryOpts {
  ctx: PuzzleCtx;
  n: number;
  /** Per cell: 0 empty, >0 given digit. */
  givens: number[];
  boardClass: string;
  /** Static extra classes per cell. */
  cellClass?: (i: number) => string;
  /** Add static children to a cell (cage labels…). */
  decorate?: (el: HTMLElement, i: number) => void;
  /** Build the board element around the n×n cells (e.g. to add edge clues). Defaults to a plain board. */
  layout?: (cells: HTMLElement[]) => HTMLElement;
  /** Cells breaking a rule right now (latin clashes, broken cages…). */
  check: (vals: number[]) => Set<number>;
  /** Extra rules for a full grid (edge clues…), on top of `check` being empty. */
  valid?: (vals: number[]) => boolean;
  /** Called after every render (clue satisfaction…). */
  after?: (vals: number[]) => void;
}

/**
 * Select-a-cell + number pad + keyboard game for Latin-square puzzles. Solved when every cell is
 * filled and `check` reports nothing. Snapshot is `{ vals, sel }`.
 */
export function latinEntry(o: LatinEntryOpts): PuzzleInstance {
  const { ctx, n, givens } = o;
  const size = n * n;
  const given = givens.map((v) => v > 0);
  const vals = [...givens];
  let sel = givens.findIndex((v) => v === 0);
  let done = false;

  const valEls: HTMLElement[] = [];
  const baseCls: string[] = [];
  const cells = givens.map((_, i) => {
    const lastC = i % n === n - 1 ? ' lc' : '',
      lastR = Math.floor(i / n) === n - 1 ? ' lr' : '';
    baseCls[i] = `cell${given[i] ? ' given' : ''} ${o.cellClass?.(i) ?? ''}${lastC}${lastR}`.replace(/\s+/g, ' ').trim();
    const el = h('button', { type: 'button', class: baseCls[i], onclick: () => select(i) });
    valEls[i] = h('span', { class: 'v' });
    el.append(valEls[i]);
    o.decorate?.(el, i);
    return el;
  });
  let grid: HTMLElement;
  if (o.layout) grid = o.layout(cells);
  else {
    grid = board(n, n, o.boardClass);
    grid.append(...cells);
  }

  const peer = (i: number, j: number) => Math.floor(i / n) === Math.floor(j / n) || i % n === j % n;
  const render = () => {
    const bad = o.check(vals);
    const sv = sel >= 0 ? vals[sel] : 0;
    cells.forEach((el, i) => {
      valEls[i].textContent = vals[i] > 0 ? String(vals[i]) : '';
      let cls = baseCls[i];
      if (i === sel) cls += ' sel';
      else if (sel >= 0 && peer(sel, i)) cls += ' peer';
      if (sv > 0 && vals[i] === sv && i !== sel) cls += ' same';
      if (bad.has(i) && !given[i]) cls += ' err';
      if (el.className !== cls) el.className = cls;
    });
    o.after?.(vals);
    ctx.status(P(vals.filter((v) => !v).length, ['left', 'left'], ['à remplir', 'à remplir']));
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
    if (bad.size === 0 && vals.every((x) => x > 0) && (o.valid?.(vals) ?? true)) {
      done = true;
      ctx.solved();
    }
  };

  const keys = Array.from({ length: n }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
  keys.push({ label: '⌫', value: '0' });

  const saved = ctx.saved as { vals?: unknown[]; sel?: unknown } | undefined;
  if (Array.isArray(saved?.vals) && saved.vals.length === size) {
    saved.vals.forEach((v, i) => {
      if (!given[i] && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= n) vals[i] = v as number;
    });
  }
  if (typeof saved?.sel === 'number' && Number.isInteger(saved.sel) && saved.sel >= -1 && saved.sel < size) sel = saved.sel;

  ctx.root.append(
    grid,
    pad(keys, (v) => (v === '0' ? sel >= 0 && vals[sel] > 0 && input(vals[sel]) : input(Number(v)))),
  );
  render();

  const step = (dr: number, dc: number) => {
    if (sel < 0) return select(0);
    const r = Math.min(n - 1, Math.max(0, Math.floor(sel / n) + dr)),
      c = Math.min(n - 1, Math.max(0, (sel % n) + dc));
    select(r * n + c);
  };

  return {
    snapshot: () => ({ vals, sel }),
    onKey(e) {
      const k = Number(e.key);
      if (k >= 1 && k <= n) {
        input(k);
        return true;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (sel >= 0 && vals[sel] > 0) input(vals[sel]);
        return true;
      }
      const mv: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (mv[e.key]) {
        step(...mv[e.key]);
        return true;
      }
      return false;
    },
  };
}

/** Tutorial steps describing the shared entry controls (tap + pad, keyboard, conflict marks). */
export function latinEntrySteps(): string[] {
  return [
    L(
      'Tap a cell, then a number on the pad. Tap the same number again, or ⌫, to erase it.',
      'Touchez une case, puis un chiffre du pavé. Touchez le même chiffre, ou ⌫, pour l’effacer.',
    ),
    L(
      'Keyboard: arrow keys move, digits fill, Backspace erases. Cells breaking a rule turn red.',
      'Au clavier : flèches pour bouger, chiffres pour remplir, Retour arrière pour effacer. Les cases fautives passent au rouge.',
    ),
  ];
}

/**
 * Tap / long-press on a button. A tap runs `tap` (through click, so keyboard and tests work);
 * holding ~0.4 s (or right-clicking) runs `long` instead. `long` should be idempotent.
 */
export function pressable(el: HTMLElement, tap: () => void, long: () => void) {
  let timer = 0,
    fired = false,
    x = 0,
    y = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = 0;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    fired = false;
    x = e.clientX;
    y = e.clientY;
    cancel();
    timer = window.setTimeout(() => {
      timer = 0;
      fired = true;
      long();
      try {
        navigator.vibrate?.(15);
      } catch {
        /* not allowed */
      }
    }, 420);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - x, e.clientY - y) > 10) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cancel();
    fired = true;
    long();
  });
  el.addEventListener('click', () => {
    if (fired) {
      fired = false;
      return;
    }
    tap();
  });
}
