/**
 * Shared tap + drag-and-drop for card tables.
 * Every card / slot element carries `data-p` (pile id) and `data-i` (index, -1 for an empty slot);
 * every pile container carries `data-pile` (drop target).
 */
export interface TableHooks {
  /** Can the card at pile p / index i (and everything above it) be picked up? */
  canDrag(p: string, i: number): boolean;
  /** Tap (click) on a card or slot. */
  tap(p: string, i: number): void;
  /** Drop the picked card(s) on pile `to`. Return true if a move happened (the game re-renders). */
  drop(p: string, i: number, to: string): boolean;
  /** Optional filter: only consider drop piles that would accept the picked card(s). */
  accepts?(p: string, i: number, to: string): boolean;
}

export function bindTable(table: HTMLElement, hooks: TableHooks): () => void {
  let drag: { p: string; i: number; x: number; y: number; els: HTMLElement[]; on: boolean; id: number } | null = null;
  let suppress = 0;

  const target = (e: Event) => (e.target as HTMLElement | null)?.closest?.('[data-p]') as HTMLElement | null;

  const onClick = (e: MouseEvent) => {
    if (performance.now() < suppress) return;
    const el = target(e);
    if (!el || !table.contains(el)) return;
    hooks.tap(el.dataset.p!, Number(el.dataset.i));
  };

  const reset = () => {
    if (!drag) return;
    for (const el of drag.els) {
      el.style.removeProperty('transform');
      el.classList.remove('lift');
    }
  };

  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    const el = target(e);
    if (!el || !el.classList.contains('pc')) return;
    const p = el.dataset.p!;
    const i = Number(el.dataset.i);
    if (!hooks.canDrag(p, i)) return;
    const els = [...table.querySelectorAll<HTMLElement>('.pc[data-p]')].filter((c) => c.dataset.p === p && Number(c.dataset.i) >= i);
    drag = { p, i, x: e.clientX, y: e.clientY, els, on: false, id: e.pointerId };
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 7) return;
      drag.on = true;
      try {
        table.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      for (const el of drag.els) el.classList.add('lift');
    }
    for (const el of drag.els) el.style.transform = `translate(${dx}px, ${dy}px)`;
    e.preventDefault();
  };

  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    if (!d.on) {
      drag = null;
      return;
    }
    suppress = performance.now() + 250;
    // Drop on the pile whose box overlaps the lead card most (pointer position breaks ties).
    const lead = d.els[0].getBoundingClientRect();
    let best: string | null = null;
    let bestA = 0;
    for (const pile of table.querySelectorAll<HTMLElement>('[data-pile]')) {
      if (pile.dataset.pile === d.p) continue;
      if (hooks.accepts && !hooks.accepts(d.p, d.i, pile.dataset.pile!)) continue;
      const r = pile.getBoundingClientRect();
      const w = Math.min(lead.right, r.right) - Math.max(lead.left, r.left);
      const hh = Math.min(lead.bottom, r.bottom) - Math.max(lead.top, r.top);
      let a = w > 0 && hh > 0 ? w * hh : 0;
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) a += lead.width * lead.height;
      if (a > bestA) {
        bestA = a;
        best = pile.dataset.pile!;
      }
    }
    const moved = best != null && hooks.drop(d.p, d.i, best);
    if (!moved) reset();
    drag = null;
  };

  const onCancel = () => {
    reset();
    drag = null;
  };

  table.addEventListener('click', onClick);
  table.addEventListener('pointerdown', onDown);
  table.addEventListener('pointermove', onMove);
  table.addEventListener('pointerup', onUp);
  table.addEventListener('pointercancel', onCancel);
  table.addEventListener('contextmenu', (e) => e.preventDefault());
  return () => {
    table.removeEventListener('click', onClick);
    table.removeEventListener('pointerdown', onDown);
    table.removeEventListener('pointermove', onMove);
    table.removeEventListener('pointerup', onUp);
    table.removeEventListener('pointercancel', onCancel);
  };
}

/** Simple undo stack of serialised states, capped so snapshots stay small. */
export class History<T> {
  stack: string[] = [];
  constructor(private cap = 60) {}
  push(state: T) {
    this.stack.push(JSON.stringify(state));
    if (this.stack.length > this.cap) this.stack.shift();
  }
  pop(): T | null {
    const s = this.stack.pop();
    return s ? (JSON.parse(s) as T) : null;
  }
  get size() {
    return this.stack.length;
  }
  restore(v: unknown) {
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) this.stack = v.slice(-this.cap);
  }
}
