import './cards.css';
import type { Rng } from '../../core/rng';
import { L, locale } from '../../core/i18n';
import { h } from '../../core/ui';

/** A playing card: suit * 13 + (rank - 1). Suits: 0 ♠, 1 ♥, 2 ♦, 3 ♣. */
export type Card = number;

const TEXT = '\uFE0E'; // force text (not emoji) presentation of suit glyphs
export const SUITS = ['♠', '♥', '♦', '♣'].map((s) => s + TEXT);
const RANKS_EN = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANKS_FR = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
/** Rank letters for the current locale (French: valet, dame, roi). */
export const ranks = () => (locale() === 'fr' ? RANKS_FR : RANKS_EN);
/** Letter shown for a rank (1 = ace … 13 = king). */
export const rankName = (r: number) => ranks()[r - 1];

export const rank = (c: Card) => (c % 13) + 1;
export const suit = (c: Card) => Math.floor(c / 13) % 4;
export const isRed = (c: Card) => suit(c) === 1 || suit(c) === 2;
export const make = (s: number, r: number): Card => s * 13 + r - 1;
export const label = (c: Card) => rankName(rank(c)) + SUITS[suit(c)];

/** Shuffled deck. `suits` picks which suits appear, `copies` repeats each suit (Spider). */
export function deck(rng: Rng, suits: number[] = [0, 1, 2, 3], copies = 1): Card[] {
  const out: Card[] = [];
  for (let k = 0; k < copies; k++) for (const s of suits) for (let r = 1; r <= 13; r++) out.push(make(s, r));
  return rng.shuffle(out);
}

const n3 = (v: number) => Math.round(v * 1000) / 1000;

/** Position helper for absolute layout inside a pile / table: x in card slots, y and dx in card widths. */
export function pos(x: number, y: number, dx = 0): string {
  let st = '';
  if (x) st += `--x:${n3(x)};`;
  if (y) st += `--y:${n3(y)};`;
  if (dx) st += `--dx:${n3(dx)};`;
  return st;
}

/** A card element. `p` = pile id, `i` = index in that pile (drives tap / drag). */
export function cardEl(c: Card, up: boolean, p: string, i: number, style = '', extra = ''): HTMLButtonElement {
  if (!up) {
    return h('button', { type: 'button', class: `pc down ${extra}`.trim(), 'data-p': p, 'data-i': i, style: style || null, 'aria-label': L('face-down card', 'carte face cachée') });
  }
  const s = SUITS[suit(c)];
  return h(
    'button',
    { type: 'button', class: `pc ${isRed(c) ? 'red' : 'blk'} ${extra}`.trim(), 'data-p': p, 'data-i': i, style: style || null, 'aria-label': label(c) },
    h('span', { class: 'pc-r' }, rankName(rank(c)), h('i', null, s)),
    h('span', { class: 'pc-s' }, s),
  );
}

/** Empty card-sized outline (pile base). Tapping it reports index -1. */
export function slotEl(p: string, text = '', extra = ''): HTMLDivElement {
  return h('div', { class: `pc-slot ${extra}`.trim(), 'data-p': p, 'data-i': -1 }, text);
}

/** Pile container placed on the table at slot x / height y (card widths). */
export function pileEl(p: string, x: number, y: number, heightCw = 1.4, extra = ''): HTMLDivElement {
  return h('div', { class: `pile ${extra}`.trim(), 'data-pile': p, style: `${pos(x, y)}--ph:${n3(heightCw)}` });
}

/**
 * Vertical offsets (in card widths) for a stacked column: face-down cards first, then face-up.
 * Compresses so the column fits `maxH` card widths.
 */
export function fan(down: number, up: number, maxH: number, dOff = 0.2, uOff = 0.42): number[] {
  const need = down * dOff + Math.max(0, up - 1) * uOff + (up ? 0 : -dOff);
  const room = maxH - 1.4;
  const k = need > room && need > 0 ? room / need : 1;
  const out: number[] = [];
  let y = 0;
  for (let i = 0; i < down + up; i++) {
    out.push(y);
    y += (i < down ? dOff : uOff) * k;
  }
  return out;
}

/** Table root: `n` slot columns wide, `hcw` card widths tall. */
export function tableEl(n: number, hcw: number, extra = ''): HTMLDivElement {
  return h('div', { class: `ctable ${extra}`.trim(), style: `--n:${n};--hcw:${hcw}` });
}
