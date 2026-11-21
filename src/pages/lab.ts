import { sheetOpen } from '../core/sheet';
import { L, locale } from '../core/i18n';
import { Card, type DailyRef } from '../core/card';
import { dailySaveKey, getSave } from '../core/saves';
import type { DailyEntry } from '../core/store';
import { prefs } from '../core/store';
import type { ShareCode } from '../core/share';
import type { Difficulty, PuzzleDef } from '../core/types';
import { btn, h } from '../core/ui';

/** A single puzzle opened from Labs: resume or new, outside the feed. */
export class LabView {
  readonly el = h('div', { class: 'lab' });
  private card: Card | null = null;
  private shown = false;

  constructor() {
    window.setInterval(() => this.card?.tick(), 250);
    document.addEventListener('keydown', (e) => {
      if (!this.shown || !this.card || sheetOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.card.onKey(e)) e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => this.card?.setActive(this.shown && !document.hidden));
    window.addEventListener('pagehide', () => this.card?.persist());
  }

  /**
   * Open puzzle `def`: resume its save unless `level` asks for a new one. With `shared`, play that exact
   * puzzle in its own save slot (resuming it if it was already started), leaving your own game alone.
   */
  open(def: PuzzleDef, level?: Difficulty, shared?: ShareCode) {
    this.close();
    const sharedSave = shared && getSave(def.id, 'shared');
    const saved = shared
      ? sharedSave && sharedSave.seed === shared.seed && sharedSave.level === shared.level
        ? sharedSave
        : undefined
      : level
        ? undefined
        : getSave(def.id);
    const save = saved && (!def.localized || (saved.locale ?? 'en') === locale()) ? saved : undefined;
    const start = (lvl?: Difficulty, resume = save, code = shared) => {
      this.card?.setActive(false);
      this.card?.destroy();
      const note = h('span', { class: 'small muted' });
      const card = new Card(def, (c) => start(c.level, undefined, undefined), {
        lab: true,
        level: code?.level ?? lvl ?? prefs(def.id).level,
        resume,
        seed: code?.seed,
        shared: !!code,
        onMount: (c) => {
          // Right after mount, `interacted` is only set when a save was resumed.
          note.textContent = c.shared
            ? L('Shared puzzle', 'Partie partagée')
            : c.interacted
              ? L('Resumed', 'Reprise')
              : L('New puzzle', 'Nouvelle partie');
          // Keep the address bar on what's being played, so a reload brings back the same puzzle.
          const hash = c.shared ? `#/s/${c.code}` : `#/game/${def.id}`;
          if (location.hash !== hash) history.replaceState(null, '', hash);
        },
      });
      this.card = card;
      this.el.replaceChildren(
        h(
          'div',
          { class: 'lab-bar' },
          h('a', { class: 'btn ghost', href: '#/games' }, L('← Games', '← Jeux')),
          note,
          btn(L('Share', 'Partager'), () => card.openShare(), 'ghost'),
        ),
        card.el,
      );
      card.mount();
      card.setActive(this.shown && !document.hidden);
    };
    start(level);
  }

  /**
   * Play puzzle `ref.index` of a daily list of `count` puzzles (resuming it if it was started).
   * `next` runs on "Next".
   */
  openDaily(def: PuzzleDef, entry: DailyEntry, ref: DailyRef, count: number, next: () => void) {
    this.close();
    const saved = getSave(dailySaveKey(ref.date, ref.level, ref.index), 'daily');
    const resume =
      saved && saved.seed === entry.seed && saved.level === ref.level && (!def.localized || (saved.locale ?? 'en') === locale())
        ? saved
        : undefined;
    const note = h('span', { class: 'small muted' });
    const card = new Card(def, next, {
      lab: true,
      level: ref.level,
      seed: entry.seed,
      resume,
      daily: ref,
      onMount: (c) => {
        note.textContent = `${L('Daily', 'Défi du jour')} · ${ref.index + 1}/${count}`;
        if (c.interacted) note.textContent += ` · ${L('Resumed', 'Reprise')}`;
      },
    });
    this.card = card;
    this.el.replaceChildren(
      h(
        'div',
        { class: 'lab-bar' },
        h('a', { class: 'btn ghost', href: `#/daily/${ref.level}` }, L('← Daily', '← Défis')),
        note,
        btn(L('Share', 'Partager'), () => card.openShare(), 'ghost'),
      ),
      card.el,
    );
    card.mount();
    card.setActive(this.shown && !document.hidden);
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
