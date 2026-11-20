type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> | null;

function apply(el: Element, attrs: Attrs, kids: Child[]) {
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.setAttribute('class', String(v));
      } else if (k === 'value' && 'value' in el) {
        (el as HTMLInputElement).value = String(v);
      } else if (k === 'checked' && 'checked' in el) {
        (el as HTMLInputElement).checked = Boolean(v);
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  for (const c of kids) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

/** Tiny DOM builder. `h('div', { class: 'x', onclick: fn }, 'text', child)` */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs, kids);
  return el;
}

/** SVG variant of `h`. */
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = null, ...kids: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  apply(el, attrs, kids);
  return el;
}

export function fmtTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Shared square board: every grid-based puzzle uses this so sizing & spacing stay identical. */
export function board(cols: number, rows = cols, extraClass = ''): HTMLDivElement {
  const n = Math.max(cols, rows);
  const gap = n >= 12 ? 3 : n >= 8 ? 4 : 6;
  const bw = n >= 12 ? 1.5 : n >= 8 ? 2 : 2.5; // cell border width
  const sh = n >= 8 ? 0 : 3; // cell shadow offset: chunky tiles on small boards only
  return h('div', {
    class: `grid ${extraClass}`.trim(),
    style: `--cols:${cols};--rows:${rows};--gap:${gap}px;--cbw:${bw}px;--csh:${sh}px`,
  });
}

/** Shared button. */
export function btn(label: string, onclick: (e: MouseEvent) => void, variant: '' | 'primary' | 'ghost' = ''): HTMLButtonElement {
  return h('button', { class: `btn ${variant}`.trim(), type: 'button', onclick }, label);
}

/** Shared key pad (row of equal keys under a board). */
export function pad(keys: { label: string; value: string; class?: string; style?: string }[], onkey: (v: string) => void): HTMLDivElement {
  const el = h('div', { class: 'pad' });
  for (const k of keys) {
    el.append(
      h('button', { class: `key ${k.class ?? ''}`.trim(), type: 'button', style: k.style, onclick: () => onkey(k.value) }, k.label),
    );
  }
  return el;
}

export function shake(el: Element) {
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}

/** Shared colour palette (CSS vars --p1..--p8). */
export const PALETTE = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)', 'var(--p6)', 'var(--p7)', 'var(--p8)'];
