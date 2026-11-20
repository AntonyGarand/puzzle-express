import { L } from './i18n';
import { Rng } from './rng';
import { openSheet } from './sheet';
import type { PuzzleDef, PuzzleInstance } from './types';
import { btn, h } from './ui';

const SEEN_KEY = 'puzzle-express:help-seen';

function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
const helpSeen = (id: string) => seenSet().has(id);
function markSeen(id: string) {
  const s = seenSet();
  s.add(id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/**
 * A real, playable Easy board inside the guide. Nothing is recorded; solving it just says "nice"
 * and offers another one.
 */
function practiceBoard(def: PuzzleDef) {
  const wrap = h('div', { class: 'practice-board', 'data-puzzle': def.id });
  const note = h('p', { class: 'practice-note' });
  let inst: PuzzleInstance = {};
  let seed = 1;
  const start = () => {
    inst.destroy?.();
    const root = h('div', { class: 'puzzle' });
    wrap.replaceChildren(root);
    note.textContent = L('Try it here — this one doesn’t count.', 'Essayez ici — cette partie ne compte pas.');
    note.className = 'practice-note';
    let finished = false;
    inst =
      def.create({
        difficulty: 1,
        rng: new Rng(0x5eed + seed++),
        root,
        solved: () => {
          if (finished) return;
          finished = true;
          note.textContent = L('Nice — that’s how it works!', 'Bravo — c’est comme ça qu’on joue!');
          note.className = 'practice-note good';
        },
        failed: () => {
          if (finished) return;
          finished = true;
          note.textContent = L('Not quite — try another one.', 'Presque — essayez-en une autre.');
          note.className = 'practice-note bad';
        },
        mistake() {},
        touch() {},
        status() {},
        controls() {},
      }) || {};
    inst.activate?.();
  };
  start();
  const again = btn(L('Another one', 'Une autre'), start, 'ghost');
  return {
    el: h(
      'section',
      { class: 'practice-section' },
      h('h3', null, L('Practice', 'Pratique')),
      wrap,
      h('div', { class: 'practice-row' }, note, again),
    ),
    onKey: (e: KeyboardEvent) => inst.onKey?.(e) ?? false,
    destroy: () => inst.destroy?.(),
  };
}

/** Show the how-to-play guide: goal, steps, a playable practice board and tips. */
function openHelp(def: PuzzleDef, onClose?: () => void) {
  markSeen(def.id);
  const help = def.help?.();
  const practice = practiceBoard(def);
  const keys = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    if (practice.onKey(e)) e.preventDefault();
  };
  document.addEventListener('keydown', keys);
  let close = () => {};
  close = openSheet({
    title: def.name,
    puzzle: def.id,
    className: 'help',
    body: [
      h('p', { class: 'help-goal' }, help?.goal ?? def.rules),
      help?.steps.length
        ? h(
            'section',
            null,
            h('h3', null, L('How to play', 'Comment jouer')),
            h('ol', { class: 'help-steps' }, ...help.steps.map((s) => h('li', null, s))),
          )
        : null,
      practice.el,
      help?.tips?.length
        ? h(
            'section',
            null,
            h('h3', null, L('Tips', 'Astuces')),
            h('ul', { class: 'help-tips' }, ...help.tips.map((s) => h('li', null, s))),
          )
        : null,
      h(
        'p',
        { class: 'help-levels muted small' },
        L(
          'Five levels, Easy to Master. On Auto, the level rises when you solve quickly and cleanly.',
          'Cinq niveaux, de Facile à Maître. En mode Auto, le niveau monte quand vous résolvez vite et sans faute.',
        ),
      ),
    ],
    footer: [btn(L('Got it', 'Compris'), () => close(), 'primary')],
    onClose: () => {
      document.removeEventListener('keydown', keys);
      practice.destroy();
      onClose?.();
    },
  });
}

/** The round "?" icon button on cards and game tiles. Unseen games get a highlighted, pulsing button. */
export function helpButton(def: PuzzleDef, opts: { onOpen?: () => void; onClose?: () => void } = {}) {
  const b = h(
    'button',
    {
      type: 'button',
      class: `icon-btn help-btn ${helpSeen(def.id) ? '' : 'fresh'}`,
      title: L('How to play', 'Comment jouer'),
      'aria-label': `${L('How to play', 'Comment jouer')}: ${def.name}`,
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        opts.onOpen?.();
        openHelp(def, () => {
          b.classList.remove('fresh');
          opts.onClose?.();
        });
      },
    },
    '?',
  );
  return b;
}
