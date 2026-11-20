import { L, locale } from '../core/i18n';
import { Card } from '../core/card';
import { getSave } from '../core/saves';
import { prefs } from '../core/store';
import type { Difficulty, PuzzleDef } from '../core/types';
import { h } from '../core/ui';

/** A single puzzle opened from Labs: resume or new, outside the feed. */
export class LabView {
  readonly el = h('div', { class: 'lab' });
  private card: Card | null = null;
  private shown = false;

  constructor() {
    window.setInterval(() => this.card?.tick(), 250);
    document.addEventListener('keydown', (e) => {
      if (!this.shown || !this.card) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.card.onKey(e)) e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => this.card?.setActive(this.shown && !document.hidden));
    window.addEventListener('pagehide', () => this.card?.persist());
  }

  /** Open puzzle `def`: resume its save unless `level` asks for a new one. */
  open(def: PuzzleDef, level?: Difficulty) {
    this.close();
    const saved = level ? undefined : getSave(def.id);
    const save = saved && (!def.localized || (saved.locale ?? 'en') === locale()) ? saved : undefined;
    const start = (lvl?: Difficulty, resume = save) => {
      this.card?.setActive(false);
      this.card?.destroy();
      const card = new Card(def, (c) => start(c.level, undefined), { lab: true, level: lvl ?? prefs(def.id).level, resume });
      this.card = card;
      this.el.replaceChildren(
        h(
          'div',
          { class: 'lab-bar' },
          h('a', { class: 'btn ghost', href: '#/games' }, L('← Games', '← Jeux')),
          h('span', { class: 'small muted' }, resume ? L('Resumed', 'Reprise') : L('New puzzle', 'Nouvelle partie')),
        ),
        card.el,
      );
      card.mount();
      card.setActive(this.shown && !document.hidden);
    };
    start(level);
  }

  setShown(shown: boolean) {
    this.shown = shown;
    this.card?.setActive(shown && !document.hidden);
  }

  close() {
    this.card?.setActive(false);
    this.card?.destroy();
    this.card = null;
  }
}
